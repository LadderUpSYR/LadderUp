from datetime import datetime, timezone
from fastapi import HTTPException
from typing import Dict, Any, Optional, List
import json

# Import DB and Session utilities
# Assuming these are available from the central server file as per previous context
from src.server_comps.database import db, bucket, store_session, delete_session
from src.server_comps.AuthManager import AuthManager

class ProfileManager:
    _instance = None
    
    def __new__(cls):
        """
        Singleton Implementation for ProfileManager
        """
        if cls._instance is None:
            cls._instance = super(ProfileManager, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "initialized", False):
            return
        self.initialized = True

    async def update_profile(self, uid: str, name: str, session_token: str, session_data: Dict[str, str]) -> Dict[str, Any]:
        """
        Updates user profile name in Firestore and Session.
        """
        if len(name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

        try:
            # 1. Update Firestore
            user_ref = db.collection("users").document(uid)
            user_ref.update({"name": name})

            # 2. Update Session (so the cookie remains valid with new name)
            session_data["name"] = name
            await store_session(session_token, session_data)

            return {
                "uid": uid,
                "name": name,
                "email": session_data.get("email")
            }
        except Exception as e:
            print(f"Error updating profile: {e}")
            raise HTTPException(status_code=500, detail="Failed to update profile")

    async def change_password(self, uid: str, new_password: str) -> None:
        """
        Updates user password. Verifies auth_provider first.
        """
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

        try:
            user_ref = db.collection("users").document(uid)
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="User not found")
            
            user_data = user_doc.to_dict()
            
            # Authorization Check
            if user_data.get("auth_provider") != "email":
                raise HTTPException(status_code=400, detail="Cannot change password for OAuth accounts")

            # Hash and Update
            password_hash = AuthManager.hash_password(new_password)
            user_ref.update({"password_hash": password_hash})
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error updating password: {e}")
            raise HTTPException(status_code=500, detail="Failed to update password")

    async def delete_account(self, uid: str, session_token: str) -> None:
        """
        Deletes user from Firestore and deletes their session.
        """
        try:
            # 1. Delete Firestore Data
            user_ref = db.collection("users").document(uid)
            user_ref.delete()

            # 2. Kill Session
            await delete_session(session_token)
        except Exception as e:
            print(f"Error deleting account: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete account")

    async def upload_resume(self, uid: str, file_content: bytes) -> str:
        """
        Uploads PDF content to Firebase Storage and returns public URL.
        """
        try:
            file_path = f"resumes/{uid}/resume.pdf"
            
            # 1. Upload to Bucket
            blob = bucket.blob(file_path)
            blob.upload_from_string(file_content, content_type='application/pdf')
            
            # 2. Make Public
            blob.make_public()
            file_url = blob.public_url

            # 3. Update User Record
            user_ref = db.collection("users").document(uid)
            user_ref.update({
                "resume_url": file_url,
                "resume_uploaded_at": datetime.now(timezone.utc).isoformat()
            })

            return file_url
        except Exception as e:
            print(f"Error uploading resume: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload resume")

    async def get_resume(self, uid: str) -> Optional[str]:
        """
        Fetches the Resume URL from the user profile.
        """
        try:
            user_ref = db.collection("users").document(uid)
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="User not found")
            
            return user_doc.to_dict().get("resume_url")
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error fetching resume: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch resume")

    async def get_answered_questions(self, uid: str) -> Dict[str, Any]:
        """
        Calculates statistics for answered questions.
        """
        try:
            user_ref = db.collection("users").document(uid)
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="User not found")
            
            user_data = user_doc.to_dict()
            answered_questions = user_data.get("answered_questions", [])
            
            # Sort most recent first
            answered_questions.sort(key=lambda x: x.get("date", ""), reverse=True)
            
            total_answered = len(answered_questions)
            if total_answered > 0:
                avg = sum(q.get("score", 0) for q in answered_questions) / total_answered
            else:
                avg = 0
            
            return {
                "answered_questions": answered_questions,
                "total_answered": total_answered,
                "average_score": round(avg, 2)
            }
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error fetching stats: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch answered questions")