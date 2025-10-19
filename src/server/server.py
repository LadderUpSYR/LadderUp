from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import id_token
from google.auth.transport import requests
import firebase_admin
from firebase_admin import credentials, firestore, storage
import os, json
from dotenv import load_dotenv
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

#uvicorn src.server.server:app --reload

# Connect to Redis
redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
SESSION_PREFIX = "session:"
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

# Fallback in-memory session store if Redis is unavailable
memory_sessions: Dict[str, Dict[str, str]] = {}


def build_session_payload(uid: str, name: str, email: str) -> Dict[str, str]:
    """Create a session payload with a refreshed expiry."""
    return {
        "uid": uid,
        "name": name,
        "email": email,
        "expires": str((datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)).timestamp())
    }


async def store_session(session_token: str, data: Dict[str, str]) -> None:
    """Persist session data in Redis, falling back to in-memory storage."""
    expires_at = data.get("expires")
    if not expires_at:
        expires_at = str((datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)).timestamp())
        data["expires"] = expires_at

    # Ensure all values are strings for Redis compatibility
    redis_payload = {k: str(v) for k, v in data.items()}

    try:
        await redis_client.hset(f"{SESSION_PREFIX}{session_token}", mapping=redis_payload)
        await redis_client.expire(f"{SESSION_PREFIX}{session_token}", SESSION_TTL_SECONDS)
    except (RedisError, AttributeError) as err:
        print(f"[session] Redis unavailable, using in-memory store: {err}")
        memory_sessions[session_token] = redis_payload


async def get_session(session_token: str) -> Optional[Dict[str, str]]:
    """Retrieve session data, preferring Redis and falling back to memory."""
    try:
        data = await redis_client.hgetall(f"{SESSION_PREFIX}{session_token}")
        if data:
            return data
    except (RedisError, AttributeError) as err:
        print(f"[session] Redis fetch failed, checking memory store: {err}")

    data = memory_sessions.get(session_token)
    if not data:
        return None

    expires = float(data.get("expires", 0))
    if expires < datetime.now(timezone.utc).timestamp():
        memory_sessions.pop(session_token, None)
        return None

    return data


async def delete_session(session_token: str) -> None:
    """Delete session data from Redis and memory."""
    try:
        await redis_client.delete(f"{SESSION_PREFIX}{session_token}")
    except (RedisError, AttributeError) as err:
        print(f"[session] Redis delete failed: {err}")

    memory_sessions.pop(session_token, None)


# Load environment variables
load_dotenv()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SERVICE_ACCOUNT_KEY = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")

SESSION_COOKIE_NAME = "session_token" # needed?

# Initialize Firebase Admin
if not SERVICE_ACCOUNT_KEY:
    raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_KEY is not set")

try:
    if SERVICE_ACCOUNT_KEY.strip().startswith("{"):
        cred = credentials.Certificate(json.loads(SERVICE_ACCOUNT_KEY))
    else:
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY)
except Exception as e:
    raise RuntimeError(f"Invalid FIREBASE_SERVICE_ACCOUNT_KEY: {e}")

firebase_admin.initialize_app(cred, {
    'storageBucket': 'ladderup-5e25d.firebasestorage.app'
})
db = firestore.client()
bucket = storage.bucket()

app = FastAPI()

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:8000","http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/auth/login")
async def login(data: dict):
    print("got a call.")
    token = data.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing token")

    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Server misconfigured: GOOGLE_CLIENT_ID not set")

    try:
        # Verify token with Google (must match React client ID)
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except Exception as exc:
        print(f"Token verification failed: {exc}")
        raise HTTPException(status_code=401, detail="Invalid token") from None

    try:
        uid = idinfo["sub"]          # unique Google user ID
        email = idinfo.get("email")
        name = idinfo.get("name", "") # creates username as google name

        # Check Firestore for user profile
        user_ref = db.collection("users").document(uid)
        doc = user_ref.get()

        userExisted = False 

        if doc.exists:
            profile = doc.to_dict()
            name = profile.get("name", name)  # fallback to Google if missing
            email = profile.get("email", email)
            userExisted = True
        else:
            profile = {
                "uid": uid,
                "name": name,
                "email": email,
                "questions": [],
                "auth_provider": "google",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            user_ref.set(profile)
            userExisted = False
        
        session_token = secrets.token_urlsafe(32)
        await store_session(session_token, build_session_payload(uid, name, email))

        # Return user info + set cookie
        response = JSONResponse({"user": {"uid": uid, "name": name, "email": email}, "msg": "User Exists" if userExisted else"New user created"})
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_token,
            httponly=True,
            secure=False,  # True in production
            samesite="lax",
            max_age=SESSION_TTL_SECONDS
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

# Helper function to hash passwords
def hash_password(password: str) -> str:
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return hash_password(password) == hashed

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str

@app.post("/api/auth/signup")
async def signup(data: SignupRequest):
    """
    Create a new user account with email and password.
    Generates a unique UID for the user.
    """
    email = data.email.lower().strip()
    password = data.password
    name = data.name.strip()

    # Validation
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

    try:
        # Check if email already exists
        users_ref = db.collection("users")
        existing_users = users_ref.where("email", "==", email).limit(1).stream()
        
        if any(existing_users):
            raise HTTPException(status_code=409, detail="Email already registered")

        # Generate a unique UID
        uid = str(uuid.uuid4())
        
        # Hash the password
        password_hash = hash_password(password)

        # Create user profile in Firestore
        user_data = {
            "uid": uid,
            "email": email,
            "name": name,
            "password_hash": password_hash, 
            "created_at": datetime.now(timezone.utc).isoformat(),
            "questions": [],
            "auth_provider": "email" # new field needs to be reflected in firestore db now
        }
        
        user_ref = db.collection("users").document(uid)
        user_ref.set(user_data)

        # Create session
        session_token = secrets.token_urlsafe(32)
        await store_session(session_token, build_session_payload(uid, name, email))

        # Return user info + set cookie
        response = JSONResponse({
            "user": {"uid": uid, "name": name, "email": email},
            "msg": "Account created successfully"
        })
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_token,
            httponly=True,
            secure=False,  # True in production
            samesite="lax",
            max_age=SESSION_TTL_SECONDS
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create account")

class LoginEmailRequest(BaseModel):
    email: str
    password: str

# any endpoint needs to be sent over https; reject otherwise...?
@app.post("/api/auth/login-email")
async def login_email(data: LoginEmailRequest):
    """
    Login with email and password (not OAuth).
    """
    email = data.email.lower().strip()
    password = data.password

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    try:
        # Find user by email
        users_ref = db.collection("users")
        users = users_ref.where("email", "==", email).limit(1).stream()
        
        user_doc = None
        for user in users:
            user_doc = user
            break
        
        if not user_doc:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        user_data = user_doc.to_dict()
        
        # Verify password (only for email auth users)
        if user_data.get("auth_provider") != "email":
            raise HTTPException(status_code=401, detail="Please use Google sign-in for this account")
        
        password_hash = user_data.get("password_hash")
        if not password_hash or not verify_password(password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Create session
        uid = user_data.get("uid")
        name = user_data.get("name")
        
        session_token = secrets.token_urlsafe(32)
        await store_session(session_token, build_session_payload(uid, name, email))

        # Return user info + set cookie
        response = JSONResponse({
            "user": {"uid": uid, "name": name, "email": email},
            "msg": "Login successful"
        })
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_token,
            httponly=True,
            secure=False,  # True in production
            samesite="lax",
            max_age=SESSION_TTL_SECONDS
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@app.post("/api/auth/logout")
async def logout(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    response = JSONResponse({"msg": "Successfully signed out"})
    
    # Always delete the cookie on the client side, regardless of server status
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    
    if not session_token:
        # No session token means nothing to do, return success
        return response 


    await delete_session(session_token)

    return response


@app.get("/api/auth/me")
async def me(request: Request):
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

    # Check if user is admin
    is_admin = await is_admin(session_data["uid"])
    
    return {
        "user": {
            "uid": session_data["uid"],
            "name": session_data["name"],
            "email": session_data["email"],
            "is_admin": is_admin
        }
    }



# questions grabbing from the DB
class QuestionRequest(BaseModel):
    questionId: int

@app.post("/api/question/id")
async def getQuestion(data: QuestionRequest):
    # data has the questionId type
    # do we also need to track who the user was making the call? Such that we can track data and analytics
    print("getQuestion endpoint called with:", data)
    valid_id = data.questionId
    #analytics.hook(id)

    question_ref = db.collection("questions").document(str(valid_id))
    qs = question_ref.get()

    if qs.exists:
        dicti = qs.to_dict()
        print("Found answer in firestore.")
    else:
        # default dictionary, is there a better way of getting this?
        dicti = {
            "answerCriteria":"This question should follow the STAR principle. They can answer in many ways, but should be short (maximum of one minute or ten sentences).",
            "avgScore":1,
            "numAttempts":0,
            "question": "Tell us about a time you had a great team member. How did they make the project better?"
            }

    response = JSONResponse(dicti)
    return response
    
@app.get("/api/question/random")
async def getRandomQuestion():
    print("getRandomQuestion endpoint called")
    try:
        questions = db.collection("questions").stream() # is this way too much data to stream...?
        all_questions = [q.to_dict() for q in questions]

        if not all_questions:
            # default question if DB empty
            dicti = {
                "answerCriteria": "This question should follow the STAR principle...",
                "avgScore": 1,
                "numAttempts": 0,
                "question": "Tell us about a time you had a great team member..."
            }
        else:
            dicti = random.choice(all_questions)
            print("Chose a random question, rather than default question")

        return JSONResponse(dicti)
    except Exception as e:
        print("Error fetching random question:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch random question")

class UpdateProfileRequest(BaseModel):
    name: str

@app.put("/api/profile/edit")
async def edit_profile(request: Request, data: UpdateProfileRequest):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    # Validate name
    if len(data.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

    try:
        # Update the user's profile in Firestore
        user_ref = db.collection("users").document(uid)
        user_ref.update({"name": data.name})

        # Update the session cache
        session_data["name"] = data.name
        await store_session(session_token, session_data)

        return {"msg": "Profile updated successfully", "user": {"uid": uid, "name": data.name, "email": session_data["email"]}}
    except Exception as e:
        print("Error updating profile:", e)
        raise HTTPException(status_code=500, detail="Failed to update profile")

class UpdatePasswordRequest(BaseModel):
    password: str

@app.put("/api/profile/change-password")
async def change_password(request: Request, data: UpdatePasswordRequest):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    # Validate password
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    try:
        # Get user data to check auth provider
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_data = user_doc.to_dict()
        
        # Only allow password changes for email auth users
        if user_data.get("auth_provider") != "email":
            raise HTTPException(status_code=400, detail="Cannot change password for OAuth accounts")

        # Hash and update the password
        password_hash = hash_password(data.password)
        user_ref.update({"password_hash": password_hash})

        return {"msg": "Password updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print("Error updating password:", e)
        raise HTTPException(status_code=500, detail="Failed to update password")

@app.delete("/api/auth/delete-account")
async def delete_account(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    try:
        # Delete the user's profile from Firestore
        user_ref = db.collection("users").document(uid)
        user_ref.delete()

        # Remove the session
        await delete_session(session_token)

        # Return response with cookie deletion
        response = JSONResponse({"msg": "Account deleted successfully"})
        response.delete_cookie(key=SESSION_COOKIE_NAME)
        return response
    except Exception as e:
        print("Error deleting account:", e)
        raise HTTPException(status_code=500, detail="Failed to delete account")

@app.post("/api/profile/upload-resume")
async def upload_resume(request: Request, file: UploadFile = File(...)):
    """Upload a resume to Firebase Storage"""
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Validate file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")

    try:
        # Create a unique filename
        file_path = f"resumes/{uid}/resume.pdf"
        
        # Upload to Firebase Storage
        blob = bucket.blob(file_path)
        blob.upload_from_string(content, content_type='application/pdf')
        
        # Make the file publicly accessible (or use signed URLs for private access)
        blob.make_public()
        
        # Get the public URL
        file_url = blob.public_url

        # Update user profile with resume URL
        user_ref = db.collection("users").document(uid)
        user_ref.update({
            "resume_url": file_url,
            "resume_uploaded_at": datetime.now(timezone.utc).isoformat()
        })

        return {"msg": "Resume uploaded successfully", "resume_url": file_url}
    except Exception as e:
        print("Error uploading resume:", e)
        raise HTTPException(status_code=500, detail="Failed to upload resume")

async def is_admin(uid: str) -> bool:
    """Check if a user has admin privileges"""
    try:
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return False
        user_data = user_doc.to_dict()
        
        # Hardcoded admin check - replace with your email for testing
        ADMIN_EMAIL = "davidortiz2587@gmail.com"
        return user_data.get("email") == ADMIN_EMAIL
        
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
                "auth_provider": user_data.get("auth_provider"),
                "created_at": user_data.get("created_at")
            }
            user_list.append(safe_user)
        
        return {"users": user_list}
    except Exception as e:
        print("Error fetching users:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@app.get("/api/profile/resume")
async def get_resume(request: Request):
    """Get the resume URL for the authenticated user"""
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = await get_session(session_token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    uid = session_data["uid"]

    try:
        # Get user profile
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_data = user_doc.to_dict()
        resume_url = user_data.get("resume_url")
        
        if not resume_url:
            return {"resume_url": None, "msg": "No resume uploaded"}
        
        return {"resume_url": resume_url}
    except HTTPException:
        raise
    except Exception as e:
        print("Error fetching resume:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch resume")