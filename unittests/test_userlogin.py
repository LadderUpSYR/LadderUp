"""
Unit tests for the Google login endpoint.
Tests the Controller Layer by mocking the AuthManager Singleton.
"""
import sys
import os
from unittest.mock import MagicMock, AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

mock_db_module = MagicMock()
mock_db_module.db = MagicMock()
mock_db_module.redis_client = MagicMock()
mock_db_module.bucket = MagicMock()
mock_db_module.SESSION_COOKIE_NAME = "__session"
mock_db_module.SESSION_TTL_SECONDS = 3600
mock_db_module.store_session = AsyncMock()
mock_db_module.get_session = AsyncMock()
mock_db_module.delete_session = AsyncMock()
mock_db_module.build_session_payload = MagicMock()

sys.modules["src.server_comps.database"] = mock_db_module
sys.modules["src.database"] = mock_db_module

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server_comps.server import app, SESSION_COOKIE_NAME


client = TestClient(app)

class TestLoginEndpoint:
    """Test the Google OAuth login endpoint via Controller Logic"""
    
    @patch("src.server_comps.server.auth_manager.login", new_callable=AsyncMock)
    def test_login_existing_user(self, mock_login):
        """Test successful Google login delegation"""
        
        # --- SETUP MOCK ---
        fake_uid = "67890"
        fake_email = "existing@example.com"
        fake_name = "Existing User"
        
        # The manager returns a dict with user info and token
        fake_response = {
            "user": {
                "uid": fake_uid,
                "name": fake_name,
                "email": fake_email,
                "is_admin": False
            },
            "token": "fake-google-session-token",
            "msg": "User Exists"
        }
        mock_login.return_value = fake_response
        
        # --- EXECUTE ---
        response = client.post(
            "/api/auth/login",
            json={
                "token": "FAKE_GOOGLE_TOKEN",
                "recaptchaToken": "test-token"
            }
        )
        
        # --- ASSERTIONS ---
        assert response.status_code == 200
        data = response.json()
        
        assert data["msg"] == "User Exists"
        assert data["user"]["uid"] == fake_uid
        assert data["user"]["name"] == fake_name
        assert data["user"]["email"] == fake_email
        
        # Check that session cookie was set
        assert SESSION_COOKIE_NAME in response.cookies
        assert response.cookies[SESSION_COOKIE_NAME] == "fake-google-session-token"
        
        # Verify manager was called with correct dict
        mock_login.assert_called_once()
        call_args = mock_login.call_args[0][0] # First arg is data dict
        assert call_args["token"] == "FAKE_GOOGLE_TOKEN"

    @patch("src.server_comps.server.auth_manager.login", new_callable=AsyncMock)
    def test_login_new_user(self, mock_login):
        """Test successful first-time Google login (Sign Up flow)"""
        
        fake_response = {
            "user": {
                "uid": "new-google-uid",
                "name": "New User",
                "email": "new@example.com",
                "is_admin": False
            },
            "token": "new-session-token",
            "msg": "New user created"
        }
        mock_login.return_value = fake_response
        
        response = client.post(
            "/api/auth/login",
            json={
                "token": "NEW_GOOGLE_TOKEN",
                "recaptchaToken": "test-token"
            }
        )
        
        assert response.status_code == 200
        assert response.json()["msg"] == "New user created"
        assert response.cookies[SESSION_COOKIE_NAME] == "new-session-token"

    @patch("src.server_comps.server.auth_manager.login", new_callable=AsyncMock)
    def test_login_invalid_token(self, mock_login):
        """Test login failure due to invalid Google token"""
        
        mock_login.side_effect = HTTPException(status_code=401, detail="Invalid token")
        
        response = client.post(
            "/api/auth/login",
            json={
                "token": "INVALID_TOKEN",
                "recaptchaToken": "test-token"
            }
        )
        
        assert response.status_code == 401
        assert "Invalid token" in response.json()["detail"]

    @patch("src.server_comps.server.auth_manager.login", new_callable=AsyncMock)
    def test_login_recaptcha_failure(self, mock_login):
        """Test login failure due to reCAPTCHA"""
        
        mock_login.side_effect = HTTPException(status_code=400, detail="reCAPTCHA verification failed")
        
        response = client.post(
            "/api/auth/login",
            json={
                "token": "VALID_TOKEN",
                "recaptchaToken": "bad-recaptcha"
            }
        )
        
        assert response.status_code == 400
        assert "reCAPTCHA" in response.json()["detail"]