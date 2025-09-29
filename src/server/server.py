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
from datetime import datetime, timedelta

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
        if not doc.exists:
            # Create new user profile
            user_ref.set({
                "name": name,
                "email": email,
                "questions": []
            })
        
        session_token = secrets.token_urlsafe(32)
        sessions[session_token] = {"uid": uid, "name": name, "email": email, "expires": datetime.utcnow() + timedelta(days=7)}

        # Return user info + set cookie
        response = JSONResponse({"user": {"uid": uid, "name": name, "email": email}})
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
    if session_data["expires"] < datetime.utcnow():
        del sessions[session_token]
        raise HTTPException(status_code=401, detail="Session expired")

    return {"user": {"uid": session_data["uid"], "name": session_data["name"], "email": session_data["email"]}}

