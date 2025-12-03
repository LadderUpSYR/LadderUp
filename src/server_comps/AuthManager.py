from fastapi import HTTPException
from google.oauth2 import id_token
from google.auth.transport import requests
from datetime import datetime, timezone
import secrets
import os
import requests as http_requests
from typing import Dict, Any, Optional
import hashlib
import uuid

# Import DB and Session utilities
from src.server_comps.database import db, store_session, build_session_payload, get_session, delete_session

class AuthManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AuthManager, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "initialized", False):
            return
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.recaptcha_secret = os.getenv("RECAPTCHA_SECRET_KEY")
        self.initialized = True

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using SHA-256"""
        return hashlib.sha256(password.encode()).hexdigest()

    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify a password against its hash"""
        return AuthManager.hash_password(password) == hashed

    async def verify_recaptcha(self, token: str) -> bool:
        if os.getenv("TESTING") == "1":
            return True
        if not self.recaptcha_secret:
            print("Server misconfigured: RECAPTCHA_SECRET_KEY not set")
            return False
        try:
            response = http_requests.post("https://www.google.com/recaptcha/api/siteverify", {
                "secret": self.recaptcha_secret,
                "response": token
            })
            return response.json().get("success", False)
        except Exception as e:
            print(f"reCAPTCHA verification failed: {e}")
            return False

    async def login(self, data: dict):
        token = data.get("token")
        recaptcha_token = data.get("recaptchaToken")
        
        if not token:
            raise HTTPException(status_code=400, detail="Missing token")
        if not recaptcha_token:
            raise HTTPException(status_code=400, detail="reCAPTCHA verification required")
            
        # Verify reCAPTCHA first
        if not await self.verify_recaptcha(recaptcha_token):
            raise HTTPException(status_code=400, detail="reCAPTCHA verification failed")

        if not self.google_client_id:
            raise HTTPException(status_code=500, detail="Server misconfigured: GOOGLE_CLIENT_ID not set")

        try:
            # Verify token with Google
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                self.google_client_id
            )
        except Exception as exc:
            print(f"Token verification failed: {exc}")
            raise HTTPException(status_code=401, detail="Invalid token") from None

        try:
            uid = idinfo["sub"]          # unique Google user ID
            email = idinfo.get("email")
            name = idinfo.get("name", "") 

            # Check Firestore for user profile
            user_ref = db.collection("users").document(uid)
            doc = user_ref.get()

            userExisted = False 

            if doc.exists:
                profile = doc.to_dict()
                name = profile.get("name", name)
                email = profile.get("email", email)
                userExisted = True
            else:
                profile = {
                    "uid": uid,
                    "name": name,
                    "email": email,
                    "questions": [],
                    "answered_questions": [],
                    "auth_provider": "google",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                user_ref.set(profile)
            
            session_token = secrets.token_urlsafe(32)
            await store_session(session_token, build_session_payload(uid, name, email))

            # Get admin status
            is_admin = profile.get("is_admin", False)
            
            # Return user info + set cookie
            return {
                "user": {
                    "uid": uid,
                    "name": name,
                    "email": email,
                    "is_admin": is_admin
                },
                "token": session_token,
                "msg": "User Exists" if userExisted else "New user created"
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"Login error: {e}")
            raise HTTPException(status_code=500, detail="Login failed")

    async def signup(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles Email/Password Signup logic.
        """
        print("AuthManager: Processing signup call.")
        
        email = data.get("email", "").lower().strip()
        password = data.get("password", "")
        name = data.get("name", "").strip()
        recaptcha_token = data.get("recaptchaToken")

        # 1. Validation
        if not await self.verify_recaptcha(recaptcha_token):
            raise HTTPException(status_code=400, detail="reCAPTCHA verification failed")

        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Invalid email address")
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

        try:
            # 2. Check existence
            users_ref = db.collection("users")
            existing_users = users_ref.where("email", "==", email).limit(1).stream()
            
            if any(existing_users):
                raise HTTPException(status_code=409, detail="Email already registered")

            # 3. Create User Data
            uid = str(uuid.uuid4())
            password_hash = self.hash_password(password)

            user_data = {
                "uid": uid,
                "email": email,
                "name": name,
                "password_hash": password_hash, 
                "created_at": datetime.now(timezone.utc).isoformat(),
                "questions": [],
                "answered_questions": [],
                "auth_provider": "email"
            }
            
            # 4. Save to Firestore
            user_ref = db.collection("users").document(uid)
            user_ref.set(user_data)

            # 5. Create Session
            session_token = secrets.token_urlsafe(32)
            await store_session(session_token, build_session_payload(uid, name, email))

            return {
                "user": {"uid": uid, "name": name, "email": email},
                "token": session_token,
                "msg": "Account created successfully"
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"Signup error inside AuthManager: {e}")
            raise HTTPException(status_code=500, detail="Failed to create account")

    async def login_email(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles Email/Password Login logic.
        """
        print("AuthManager: Processing email login call.")

        email = data.get("email", "").lower().strip()
        password = data.get("password", "")
        recaptcha_token = data.get("recaptchaToken")

        # 1. Validation
        if not await self.verify_recaptcha(recaptcha_token):
            raise HTTPException(status_code=400, detail="reCAPTCHA verification failed")

        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")

        try:
            # 2. Find user by email
            users_ref = db.collection("users")
            users = users_ref.where("email", "==", email).limit(1).stream()
            
            user_doc = None
            for user in users:
                user_doc = user
                break
            
            if not user_doc:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            user_data = user_doc.to_dict()
            
            # 3. Verify Auth Provider & Password
            if user_data.get("auth_provider") != "email":
                raise HTTPException(status_code=401, detail="Please use Google sign-in for this account")
            
            password_hash = user_data.get("password_hash")
            if not password_hash or not self.verify_password(password, password_hash):
                raise HTTPException(status_code=401, detail="Invalid email or password")

            # 4. Create Session
            uid = user_data.get("uid")
            name = user_data.get("name")
            
            session_token = secrets.token_urlsafe(32)
            await store_session(session_token, build_session_payload(uid, name, email))

            is_admin = user_data.get("is_admin", False)

            return {
                "user": {
                    "uid": uid,
                    "name": name,
                    "email": email,
                    "is_admin": is_admin
                },
                "token": session_token,
                "msg": "Login successful"
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"Login Email error inside AuthManager: {e}")
            raise HTTPException(status_code=500, detail="Login failed")

    async def logout(self, session_token: Optional[str]) -> Optional[str]:
        if not session_token:
            return None

        # Retrieve session data to identify the user before deletion
        session_data = await get_session(session_token)
        uid = session_data.get("uid") if session_data else None
        
        # Delete the session from store
        await delete_session(session_token)
        
        return uid