from fastapi import FastAPI, HTTPException, Request, UploadFile, File, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import id_token
from google.auth.transport import requests
import firebase_admin
from firebase_admin import credentials, firestore, storage
import os, json
from dotenv import load_dotenv
import requests as http_requests
from fastapi.responses import JSONResponse
import secrets
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import random
from fastapi.encoders import jsonable_encoder
import hashlib
import uuid
import redis.asyncio as redis
from redis.exceptions import RedisError
from typing import Dict, Optional

from src.server_comps.database import db, redis_client, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, get_session, delete_session

#singleton class managers

from src.server_comps.AuthManager import AuthManager
auth_manager = AuthManager()

from src.server_comps.ProfileManager import ProfileManager
profile_manager = ProfileManager()

from src.server_comps.QuestionManager import QuestionManager
question_manager = QuestionManager()

#uvicorn src.server.server:app --reload

# Load environment variables
load_dotenv()
app = FastAPI()

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:8000","http://localhost:5000","http://localhost:5001","https://ladderup-5e25d.web.app",
"https://ladderup-5e25d.firebaseapp.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Practice Mode STT WebSocket 
# Import the practice STT handler from separate module
from .practice_stt_fastapi import practice_stt_websocket_handler

# Polymorphic Logging Base Class

from abc import ABC, abstractmethod

# interface
class LoggableEvent(ABC):
    @abstractmethod
    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        # define at every new level
        pass
    # no dataum needed
    # 

@app.websocket("/ws/practice")
async def practice_stt_websocket(websocket: WebSocket):
    """WebSocket endpoint for practice mode speech-to-text"""
    await practice_stt_websocket_handler(websocket)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/auth/login")
async def login(data: dict):
    result = await auth_manager.login(data)
    response = JSONResponse(result)
    
    # FIX: Extract the token from the result dict
    session_token = result.get("token")
    
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=True,  # True in production
        samesite="lax",
        max_age=SESSION_TTL_SECONDS
    )
    return response

class SignupRequest(BaseModel, LoggableEvent):
    email: str
    password: str
    name: str
    recaptchaToken: str

    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        print(f"[SECURITY] Got a signup request for {self.email} at {datetime.now()} | UUID: {uuid or 'N/A'}")


@app.post("/api/auth/signup")
async def signup(data: SignupRequest):
    """
    Create a new user account with email and password.
    Generates a unique UID for the user.
    """
    # Log
    data.log(uuid=None) 
    
    try:
        # Delegate Logic to Singleton Manager
        # We convert the Pydantic model to a dict for the manager
        result = await auth_manager.signup(data.dict())

        # 3. Handle Response & Cookies
        response = JSONResponse(result)
        
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=result["token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=SESSION_TTL_SECONDS
        )
        return response

    except HTTPException as e:
        raise e
    except Exception as e:
        # Fallback for unexpected errors
        print(f"Signup Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create account")

class LoginEmailRequest(BaseModel, LoggableEvent):
    email: str
    password: str
    recaptchaToken: str

    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        print(f"[SECURITY] Got a Login Attempt Event via email at {datetime.now()} for {self.email} | UUID: {uuid or 'N/A'}")


@app.post("/api/auth/login-email")
async def login_email(data: LoginEmailRequest):
    """
    Login with email and password (not OAuth).
    """
    # 1. Log the event
    data.log(uuid=None)
    
    try:
        # 2. Delegate to Singleton Manager
        result = await auth_manager.login_email(data.dict())

        # 3. Handle Response & Cookies
        response = JSONResponse(result)
        
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=result["token"],
            httponly=True,
            secure=True,  # True in production
            samesite="lax",
            max_age=SESSION_TTL_SECONDS
        )
        return response

    except HTTPException as e:
        raise e
    except Exception as e:
        # Fallback error handling
        print(f"Login Email Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

class LogoutRequest(BaseModel, LoggableEvent):
    email: str 

    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        ip_address = "system"
        user_agent = "unknown"
        if request:
            forwarded = request.headers.get("X-Forwarded-For")
            ip_address = forwarded.split(",")[0] if forwarded else request.client.host
            user_agent = request.headers.get("User-Agent", "unknown")

        # Build the JSON Payload
        log_payload = {
            # REQUIRED for GCP to color-code the log blue/green
            "severity": "INFO", 
            "event": "user_logout", 
            "email": self.email,
            "uuid": uuid or "N/A",
            "ip": ip_address,
            "user_agent": user_agent,
            "message": f"[AUTH] User {self.email} logged out."
        }
        print(json.dumps(log_payload))


@app.post("/api/auth/logout")
async def logout(request: Request, data: LogoutRequest):
    """
    Logs out the user by deleting their session on server and cookie on client.
    """
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    
    # Prepare response (always delete cookie)
    response = JSONResponse({"msg": "Successfully signed out"})
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    
    # Delegate logic to Manager (returns UID if session was valid)
    uid = await auth_manager.logout(session_token)

    # Log the event (Controller concern)
    data.log(request, uuid=uid)

    return response

class AuthCheckRequest(BaseModel, LoggableEvent):
    pass

    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        log_payload = {
            "severity": "INFO",
            "event": "auth_check",
            "uuid": uuid or "N/A",
            "ip": request.headers.get("X-Forwarded-For", request.client.host) if request else "unknown",
            "message": f"🔍 [AUTH] IP Address {request.headers.get('X-Forwarded-For', request.client.host) if request else 'unknown'} checked session. UUID: {uuid or 'N/A'}"
        }
        print(json.dumps(log_payload))


@app.get("/api/auth/me")
async def me(request: Request, data: AuthCheckRequest = Depends()):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check Redis/in-memory for session data
    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    # Optional: check expiration
    # FIX 2: Replaced datetime.utcnow() with timezone-aware datetime.now(timezone.utc)
    if float(session_data["expires"]) < datetime.now(timezone.utc).timestamp():
        await delete_session(session_token)
        raise HTTPException(status_code=401, detail="Session expired")

    user_is_admin = await is_admin(session_data["uid"])

    data.log(request, uuid=session_data["uid"])
    
    return {
        "user": {
            "uid": session_data["uid"],
            "name": session_data["name"],
            "email": session_data["email"],
            "is_admin": user_is_admin
        }
    }

# questions grabbing from the DB
class QuestionRequest(BaseModel, LoggableEvent):
    questionId: int

    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        print(f"[DATABASE] Pulling a question from the DB of question id {self.questionId} | UUID: {uuid or 'N/A'}")

@app.post("/api/question/id")
async def getQuestion(data: QuestionRequest):
    result = await question_manager.get_question_by_id(data.questionId)
    data.log(uuid=None)
    return JSONResponse(result)

class RandomQuestionRequest(BaseModel, LoggableEvent):
    pass # get class
    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        ip_address = "system"
        user_agent = "unknown"
        if request:
            forwarded = request.headers.get("X-Forwarded-For")
            ip_address = forwarded.split(",")[0] if forwarded else request.client.host
            user_agent = request.headers.get("User-Agent", "unknown")

        # Build the JSON Payload
        log_payload = {
            # REQUIRED for GCP to color-code the log blue/green
            "severity": "INFO", 
            "event": "random_question_requested", 
            "uuid": uuid or "N/A",
            "ip": ip_address,
            "user_agent": user_agent,
            "message": f"[DATABASE] Random Question asked, given to ip {ip_address}"
        }
        print(json.dumps(log_payload))

@app.get("/api/question/random")
async def getRandomQuestion(request: Request, data: RandomQuestionRequest = Depends()):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    uid = None
    if session_token:
        try:
            session_data = await get_session(session_token)
            if session_data:
                uid = session_data.get("uid")
        except:
            pass
    
    result = await question_manager.get_random_question()
    data.log(request, uuid=uid)
    return JSONResponse(result)




class SubmitAnswerRequest(BaseModel, LoggableEvent):
    questionId: str
    question: str
    answer: str
    answerCriteria: Optional[str] = None

    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        ip_address = "system"
        user_agent = "unknown"
        if request:
            forwarded = request.headers.get("X-Forwarded-For")
            ip_address = forwarded.split(",")[0] if forwarded else request.client.host
            user_agent = request.headers.get("User-Agent", "unknown")

        # Build the JSON Payload
        log_payload = {
            # REQUIRED for GCP to color-code the log blue/green
            "severity": "INFO", 
            "event": "answer_submitted_for_grading", 
            "uuid": uuid or "N/A",
            "ip": ip_address,
            "user_agent": user_agent,
            "message": f"[LLM GRADING] starting to grade answer: {self.answer} on question: {self.questionId} | text: {self.question}"
        }
        print(json.dumps(log_payload))


from src.server_comps.answer_to_db_middleware import answer_to_db_middleware

@app.post("/api/question/submit")
async def submit_answer(request: Request, data: SubmitAnswerRequest):
    """Submit an answer to a question and record it in the user's profile with LLM grading"""
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    # Validate inputs
    if not data.questionId or not data.answer:
        raise HTTPException(status_code=400, detail="Question ID and answer are required")

    try:
        # 1. Use the middleware to handle Grading + Database Saving
        # This replaces the manual grader initialization and DB update logic
        data.log(request, uuid=uid)
        answer_record = await answer_to_db_middleware(
            answer=data.answer,
            question_id=data.questionId,
            player_uuid=uid
        )

        # 2. Fetch User Data for 'total_answered' count
        # (The middleware returns the specific answer, but your frontend expects the total count)
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        total_answered = 0
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            answered_questions = user_data.get("answered_questions", [])
            total_answered = len(answered_questions)

        # 3. Return response matching the original API contract
        return {
            "msg": "Answer submitted and graded successfully",
            "answer_record": answer_record,
            "total_answered": total_answered,
            # Reconstruct the 'grading' object for frontend compatibility
            "grading": {
                "score": answer_record.get("score"),
                "feedback": answer_record.get("feedback"),
                "strengths": answer_record.get("strengths"),
                "improvements": answer_record.get("improvements")
            }
        }

    except ValueError as ve:
        # Handle cases where middleware raises ValueError (e.g. Question not found)
        raise HTTPException(status_code=404, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        print("Error submitting answer:", e)
        raise HTTPException(status_code=500, detail=f"Failed to submit answer: {str(e)}")

class UpdateProfileRequest(BaseModel, LoggableEvent):
    name: str

    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        ip_address = "system"
        user_agent = "unknown"
        if request:
            forwarded = request.headers.get("X-Forwarded-For")
            ip_address = forwarded.split(",")[0] if forwarded else request.client.host
            user_agent = request.headers.get("User-Agent", "unknown")

        log_payload = {
            "severity": "INFO",
            "event": "profile_updated",
            "uuid": uuid or "N/A",
            "ip": ip_address,
            "user_agent": user_agent,
            "message": f"[PROFILE] User {uuid or 'unknown'} updated their profile"
        }
        print(json.dumps(log_payload))

class UpdatePasswordRequest(BaseModel, LoggableEvent):
    password: str

    def log(self, request: Optional[Request] = None, uuid: Optional[str] = None):
        ip_address = "system"
        user_agent = "unknown"
        if request:
            forwarded = request.headers.get("X-Forwarded-For")
            ip_address = forwarded.split(",")[0] if forwarded else request.client.host
            user_agent = request.headers.get("User-Agent", "unknown")

        log_payload = {
            "severity": "INFO",
            "event": "password_changed",
            "uuid": uuid or "N/A",
            "ip": ip_address,
            "user_agent": user_agent,
            "message": f"[SECURITY] User {uuid or 'unknown'} changed their password"
        }
        print(json.dumps(log_payload))


@app.put("/api/profile/edit")
async def edit_profile(request: Request, data: UpdateProfileRequest):
    # 1. Auth Check
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    uid = session_data["uid"]

    # 2. Delegate to Manager
    # We pass session_data/token because the manager needs to update the session cache
    updated_user = await profile_manager.update_profile(uid, data.name, session_token, session_data)

    # 3. Log
    data.log(request, uuid=uid)

    return {"msg": "Profile updated successfully", "user": updated_user}


@app.put("/api/profile/change-password")
async def change_password(request: Request, data: UpdatePasswordRequest):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    # Delegate to Manager
    await profile_manager.change_password(uid, data.password)

    # Log
    data.log(request, uuid=uid)

    return {"msg": "Password updated successfully"}


@app.delete("/api/auth/delete-account")
async def delete_account(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    # Delegate to Manager
    await profile_manager.delete_account(uid, session_token)

    response = JSONResponse({"msg": "Account deleted successfully"})
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return response


@app.post("/api/profile/upload-resume")
async def upload_resume(request: Request, file: UploadFile = File(...)):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    # Validate Request (Controller Concern)
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")

    # Delegate Logic (Manager Concern)
    file_url = await profile_manager.upload_resume(uid, content)

    return {"msg": "Resume uploaded successfully", "resume_url": file_url}


@app.get("/api/profile/resume")
async def get_resume(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    resume_url = await profile_manager.get_resume(uid)
    
    if not resume_url:
        return {"resume_url": None, "msg": "No resume uploaded"}
    
    return {"resume_url": resume_url}


@app.get("/api/profile/answered-questions")
async def get_answered_questions(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    return await profile_manager.get_answered_questions(uid)

async def is_admin(uid: str) -> bool:
    """Check if a user has admin privileges"""
    try:
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return False
        user_data = user_doc.to_dict()
        
        # Check the is_admin field from Firebase
        return user_data.get("is_admin", False)
        
    except Exception:
        return False

@app.get("/api/admin/users")
async def get_all_users(request: Request):
    """Get all users (admin only endpoint)"""
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]
    
    # Check if user is admin
    if not await is_admin(uid):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        # Get all users from Firestore
        users_ref = db.collection("users")
        users = users_ref.stream()
        
        # Convert to list of dicts, excluding sensitive fields
        user_list = []
        for user in users:
            user_data = user.to_dict()
            # Exclude sensitive information
            safe_user = {
                "uid": user_data.get("uid"),
                "name": user_data.get("name"),
                "email": user_data.get("email"),
                "questions": user_data.get("questions", []),
                "answered_questions": user_data.get("answered_questions", []),
                "auth_provider": user_data.get("auth_provider"),
                "created_at": user_data.get("created_at")
            }
            user_list.append(safe_user)
        
        return {"users": user_list}
    except Exception as e:
        print("Error fetching users:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@app.get("/api/matchmaking/queue-status")
async def get_queue_status():
    """Get the current matchmaking queue status and estimated wait time"""
    try:
        queue_size = await redis_client.llen("match_queue")
        
        # Calculate estimated wait time based on queue size
        # Assuming average match time is 2 seconds per pair
        if queue_size == 0:
            estimated_wait_seconds = 5  # Base wait time when queue is empty
        elif queue_size == 1:
            estimated_wait_seconds = 10  # Waiting for one more player
        else:
            # If multiple people in queue, matches happen quickly
            estimated_wait_seconds = 3
        
        return {
            "queue_size": queue_size,
            "estimated_wait_seconds": estimated_wait_seconds,
            "estimated_wait_text": f"{estimated_wait_seconds}s" if estimated_wait_seconds < 60 else f"{estimated_wait_seconds // 60}m"
        }
    except Exception as e:
        print(f"Error fetching queue status: {e}")
        # Return default values if Redis is unavailable
        return {
            "queue_size": 0,
            "estimated_wait_seconds": 10,
            "estimated_wait_text": "10s"
        }

@app.get("/debug/redis")
async def debug_redis():
    try:
        pong = await redis_client.ping()
        return {"ok": True, "message": pong}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.get("/debug/cookies")
async def debug_cookies(request: Request):
    """
    Echoes back all cookies received by the server.
    Useful for checking if Firebase Hosting is stripping them.
    """
    print(f"DEBUG: Received cookies: {request.cookies}")
    return {
        "cookies_received": request.cookies,
        "cookie_count": len(request.cookies),
        "headers": dict(request.headers)  # Inspect headers to see if Via/Forwarded-For are set
    }