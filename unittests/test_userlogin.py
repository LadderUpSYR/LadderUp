from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from src.server.server import app  # assuming your FastAPI code is in main.py
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from pathlib import Path


client = TestClient(app)


def test_login_new_user():
    fake_uid = "12345"
    fake_name = "Test User"

    # Mock verify_oauth2_token
    with patch("src.server.server.id_token.verify_oauth2_token") as mock_verify, \
         patch("src.server.server.db") as mock_db:

        mock_verify.return_value = {
            "sub": fake_uid,
            "email": "test@example.com",
            "name": fake_name
        }

        # Mock Firestore behavior
        fake_doc = MagicMock()
        fake_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc

        response = client.post("/api/auth/login", json={"token": "FAKE_TOKEN"})

        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "New user created"
        assert data["user"] is not None

        # we need to test on set cookies, maybe?

        assert data["user"]["uid"] == fake_uid

        # Ensure Firestore .set() was called
        mock_db.collection.return_value.document.return_value.set.assert_called_once_with({
            "name": fake_name,
            "email": 'test@example.com',
            "questions": []
        })


def test_login_existing_user():
    fake_uid = "67890"
    fake_profile = {"name": "Existing User", "questions": [True, False, True]}

    with patch("src.server.server.id_token.verify_oauth2_token") as mock_verify, \
         patch("src.server.server.db") as mock_db:

        mock_verify.return_value = {
            "sub": fake_uid,
            "email": "existing@example.com",
            "name": "Existing User"
        }

        fake_doc = MagicMock()
        fake_doc.exists = True
        fake_doc.to_dict.return_value = fake_profile
        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc

        response = client.post("/api/auth/login", json={"token": "FAKE_TOKEN"})

        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "User Exists"
        assert data["user"] is not None

        # we need to test on set cookies, maybe?

        assert data["user"]["uid"] == fake_uid


    