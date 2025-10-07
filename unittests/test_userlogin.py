from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

# Import your helper to load app with patched env
from .test_auth_login import _load_app_with_env  # or define _load_app_with_env() in this file

# ----------------- Tests -----------------

def test_login_new_user():
    appmod, client, _ = _load_app_with_env()  # get app and client safely

    fake_uid = "12345"
    fake_name = "Test User"

    # Mock verify_oauth2_token and Firestore
    with patch("src.server.server.id_token.verify_oauth2_token") as mock_verify, \
         patch("src.server.server.db") as mock_db:

        mock_verify.return_value = {
            "sub": fake_uid,
            "email": "test@example.com",
            "name": fake_name
        }

        fake_doc = MagicMock()
        fake_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc

        response = client.post("/api/auth/login", json={"token": "FAKE_TOKEN"})

    assert response.status_code == 200
    data = response.json()
    assert data["msg"] == "New user created"
    assert data["user"]["uid"] == fake_uid
    assert data["user"]["name"] == fake_name
    assert data["user"]["email"] == "test@example.com"

    # Ensure Firestore .set() was called for new user with correct structure
    call_args = mock_db.collection.return_value.document.return_value.set.call_args
    assert call_args is not None
    set_data = call_args[0][0]
    assert set_data["uid"] == fake_uid
    assert set_data["name"] == fake_name
    assert set_data["email"] == "test@example.com"
    assert set_data["questions"] == []
    assert set_data["auth_provider"] == "google"
    assert "created_at" in set_data

    # Check session cookie
    cookie = response.cookies.get(appmod.SESSION_COOKIE_NAME)
    assert cookie is not None
    assert len(cookie) > 0


def test_login_existing_user():
    appmod, client, _ = _load_app_with_env()  # safe client

    fake_uid = "67890"
    fake_profile = {"name": "Existing User", "email": "jimmy@gmail.com", "questions": [True, False, True]}

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
    assert data["user"]["uid"] == fake_uid
    assert data["user"]["name"] == fake_profile["name"]
    assert data["user"]["email"] == fake_profile["email"]

    # Check session cookie
    cookie = response.cookies.get(appmod.SESSION_COOKIE_NAME)
    assert cookie is not None
    assert len(cookie) > 0
