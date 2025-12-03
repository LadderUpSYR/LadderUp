"""
Unit tests for the signup endpoint.
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

class TestPasswordHashing:
    """
    Test password hashing utilities.
    Note: Since we moved logic to AuthManager, we should ideally test AuthManager directly,
    but we can also mock the static methods if we want to test utilities in isolation.
    """
    
    # Since we can't easily import the static methods from the server instance directly without
    # instantiating the manager, we will skip these or move them to a test_auth_manager.py file.
    # For this file, we focus on the ENDPOINTs.
    pass


class TestSignupEndpoint:
    """Test the signup endpoint via Controller Logic"""
    
    @patch("src.server_comps.server.auth_manager.signup", new_callable=AsyncMock)
    def test_signup_success(self, mock_signup):
        """Test successful user signup delegation"""
        
        # --- SETUP MOCK ---
        # The manager returns a dict with user info and token
        fake_response = {
            "user": {
                "uid": "new-uid-123",
                "name": "Test User",
                "email": "test@example.com"
            },
            "token": "fake-session-token",
            "msg": "Account created successfully"
        }
        mock_signup.return_value = fake_response
        
        # --- EXECUTE ---
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "test@example.com",
                "password": "password123",
                "name": "Test User",
                "recaptchaToken": "test-token"
            }
        )
        
        # --- ASSERTIONS ---
        assert response.status_code == 200
        data = response.json()
        
        assert data["user"]["email"] == "test@example.com"
        assert data["user"]["uid"] == "new-uid-123"
        assert data["msg"] == "Account created successfully"
        
        # Check that session cookie was set from the token returned by manager
        assert SESSION_COOKIE_NAME in response.cookies
        assert response.cookies[SESSION_COOKIE_NAME] == "fake-session-token"
        
        # Verify manager was called with correct dict
        mock_signup.assert_called_once()
        call_args = mock_signup.call_args[0][0] # First arg is data dict
        assert call_args["email"] == "test@example.com"

    @patch("src.server_comps.server.auth_manager.signup", new_callable=AsyncMock)
    def test_signup_duplicate_email(self, mock_signup):
        """Test that duplicate email error from manager is passed through"""
        
        # Mock the manager raising an HTTP Exception
        mock_signup.side_effect = HTTPException(status_code=409, detail="Email already registered")
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "existing@example.com",
                "password": "password123",
                "name": "Test User",
                "recaptchaToken": "test-token"
            }
        )
        
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"]

    @patch("src.server_comps.server.auth_manager.signup", new_callable=AsyncMock)
    def test_signup_validation_error(self, mock_signup):
        """Test that validation error (e.g. invalid email) from manager is passed through"""
        
        mock_signup.side_effect = HTTPException(status_code=400, detail="Invalid email address")
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "notanemail",
                "password": "password123",
                "name": "Test User",
                "recaptchaToken": "test-token"
            }
        )
        
        assert response.status_code == 400
        assert "Invalid email" in response.json()["detail"]


class TestEmailLoginEndpoint:
    """Test the email/password login endpoint via Controller Logic"""
    
    @patch("src.server_comps.server.auth_manager.login_email", new_callable=AsyncMock)
    def test_login_success(self, mock_login_email):
        """Test successful login delegation"""
        
        fake_response = {
            "user": {
                "uid": "test-uid-123",
                "name": "Test User",
                "email": "test@example.com",
                "is_admin": False
            },
            "token": "login-session-token",
            "msg": "Login successful"
        }
        mock_login_email.return_value = fake_response
        
        response = client.post(
            "/api/auth/login-email",
            json={
                "email": "test@example.com",
                "password": "password123",
                "recaptchaToken": "test-token"
            }
        )
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Login successful"
        assert response.cookies[SESSION_COOKIE_NAME] == "login-session-token"
        
        mock_login_email.assert_called_once()

    @patch("src.server_comps.server.auth_manager.login_email", new_callable=AsyncMock)
    def test_login_wrong_password(self, mock_login_email):
        """Test login failure delegation"""
        
        mock_login_email.side_effect = HTTPException(status_code=401, detail="Invalid email or password")
        
        response = client.post(
            "/api/auth/login-email",
            json={
                "email": "test@example.com",
                "password": "wrongpassword",
                "recaptchaToken": "test-token"
            }
        )
        
        assert response.status_code == 401
        assert "Invalid" in response.json()["detail"]