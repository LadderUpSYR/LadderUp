from fastapi import FastAPI, HTTPException
from google.oauth2 import id_token
from google.auth.transport import requests
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SERVICE_ACCOUNT_KEY = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")

# Initialize Firebase Admin
cred = credentials.Certificate(SERVICE_ACCOUNT_KEY)
firebase_admin.initialize_app(cred)
db = firestore.client()

app = FastAPI()

@app.post("/api/auth/login")
async def login(data: dict):
    token = data.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing token")

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
                "questions": []
            })
            return {"msg": "New user created", "uid": uid}

        # Existing user
        return {"msg": "User exists", "uid": uid, "profile": doc.to_dict()}

    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
