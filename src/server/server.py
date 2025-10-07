from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import id_token
from google.auth.transport import requests
import firebase_admin
from firebase_admin import credentials, firestore
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

firebase_admin.initialize_app(cred)
db = firestore.client()

app = FastAPI()

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = {} # live cache for active sessions

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
        sessions[session_token] = {"uid": uid, "name": name, "email": email, "expires": datetime.now(timezone.utc) + timedelta(days=7)}

        # Return user info + set cookie
        response = JSONResponse({"user": {"uid": uid, "name": name, "email": email}, "msg": "User Exists" if userExisted else"New user created"})
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_token,
            httponly=True,
            secure=False,  # True in production
            samesite="lax",
            max_age=7*24*60*60
        )
        return response

    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

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
        sessions[session_token] = {
            "uid": uid,
            "name": name,
            "email": email,
            "expires": datetime.now(timezone.utc) + timedelta(days=7)
        }

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
            max_age=7*24*60*60
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
        sessions[session_token] = {
            "uid": uid,
            "name": name,
            "email": email,
            "expires": datetime.now(timezone.utc) + timedelta(days=7)
        }

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
            max_age=7*24*60*60
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@app.post("/api/auth/logout")
async def me(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token or session_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # otherwise remove from out cache

    del sessions[session_token]
    print(sessions)
    return {"msg":"Successfuly signed out from the session"}

@app.get("/api/auth/me")
async def me(request: Request):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token or session_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_data = sessions[session_token]
    # Optional: check expiration
    if session_data["expires"] < datetime.now(timezone.utc):
        del sessions[session_token]
        raise HTTPException(status_code=401, detail="Session expired")

    return {"user": {"uid": session_data["uid"], "name": session_data["name"], "email": session_data["email"]}}



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
    if not session_token or session_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = sessions[session_token]
    uid = session_data["uid"]

    try:
        # Update the user's profile in Firestore
        user_ref = db.collection("users").document(uid)
        user_ref.update({"name": data.name})

        # Update the session cache
        session_data["name"] = data.name
        sessions[session_token] = session_data

        return {"msg": "Profile updated successfully", "user": {"uid": uid, "name": data.name, "email": session_data["email"]}}
    except Exception as e:
        print("Error updating profile:", e)
        raise HTTPException(status_code=500, detail="Failed to update profile")

class UpdatePasswordRequest(BaseModel):
    password: str

@app.put("/api/profile/change-password")
async def change_password(request: Request, data: UpdatePasswordRequest):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token or session_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = sessions[session_token]
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
    if not session_token or session_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = sessions[session_token]
    uid = session_data["uid"]

    try:
        # Delete the user's profile from Firestore
        user_ref = db.collection("users").document(uid)
        user_ref.delete()

        # Remove the session
        del sessions[session_token]

        return {"msg": "Account deleted successfully"}
    except Exception as e:
        print("Error deleting account:", e)
        raise HTTPException(status_code=500, detail="Failed to delete account")