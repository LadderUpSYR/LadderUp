import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from pathlib import Path


class Profile(BaseModel):
    userName: str
    questionsAttempted: list[bool]



def test_firebase_connection():
    '''
    Testing if a firebase connection can be established.    
    '''
    dotenv_path = Path('.env')
    load_dotenv(dotenv_path=dotenv_path)
    print("ENV FIREBASE_CREDENTIALS =", os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY"))


     # Initialize Firebase Admin

    cred = credentials.Certificate(os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY"))
    firebase_admin.initialize_app(cred, name="test_app_1")

    db = firestore.client()

    uid = "TESToPtzAR7joj2J7DDAtYRt"
        # Check Firestore for user profile
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()
    assert doc.exists

    profile = Profile(**doc.to_dict())
    assert profile is not None
    assert profile.userName is not None
    assert profile.userName == "John Doe"


