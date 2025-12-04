"""
Authentication and login tests.

Refactored to test the Controller Layer by mocking the AuthManager Singleton.
Uses sys.modules mocking to bypass real Firebase/Redis connections.
"""
import sys
import os
from unittest.mock import MagicMock, AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone

# --- 1. System Mocking (Must happen before server imports) ---
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

# Inject mocks into sys.modules
sys.modules["src.server_comps.database"] = mock_db_module
sys.modules["src.database"] = mock_db_module

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server_comps.server import app, SESSION_COOKIE_NAME

# --- 2. Client Fixture ---
@pytest.fixture
def client():
    """Yields a fresh TestClient for every test case."""
    return TestClient(app)

# ------------------ Health Check ------------------
def test_health_ok(client):
    """Test health endpoint"""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}

# ------------------ Auth Endpoint Tests ------------------

class TestGoogleLogin:
    """Test /api/auth/login (Google OAuth)"""

    @patch("src.server_comps.server.auth_manager.login", new_callable=AsyncMock)
    def test_login_success(self, mock_login, client):
        """Test successful login delegation and cookie setting"""
        # 1. Mock Manager Return
        fake_token = "session_token_123"
        mock_login.return_value = {
            "user": {"uid": "123", "email": "test@test.com", "name": "Test"},
            "token": fake_token,
            "msg": "User Exists"
        }

        # 2. Execute
        payload = {"token": "google_jwt", "recaptchaToken": "valid_captcha"}
        response = client.post("/api/auth/login", json=payload)

        # 3. Assert Response
        assert response.status_code == 200
        assert response.json()["msg"] == "User Exists"
        
        # 4. Assert Cookie was set (Controller responsibility)
        assert response.cookies.get(SESSION_COOKIE_NAME) == fake_token
        
        # 5. Assert Manager was called
        mock_login.assert_called_once_with(payload)

    @patch("src.server_comps.server.auth_manager.login", new_callable=AsyncMock)
    def test_login_missing_token(self, mock_login, client):
        """Test manager raising exception for bad input"""
        mock_login.side_effect = HTTPException(status_code=400, detail="Missing token")

        response = client.post("/api/auth/login", json={"recaptchaToken": "test"})
        
        assert response.status_code == 400
        assert response.json()["detail"] == "Missing token"

    @patch("src.server_comps.server.auth_manager.login", new_callable=AsyncMock)
    def test_login_invalid_token(self, mock_login, client):
        """Test manager raising exception for invalid Google Token"""
        mock_login.side_effect = HTTPException(status_code=401, detail="Invalid token")

        response = client.post("/api/auth/login", json={"token": "BAD", "recaptchaToken": "test"})
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"


class TestEmailSignup:
    """Test /api/auth/signup"""

    @patch("src.server_comps.server.auth_manager.signup", new_callable=AsyncMock)
    def test_signup_success(self, mock_signup, client):
        """Test successful signup delegation"""
        fake_token = "new_session_token"
        mock_signup.return_value = {
            "user": {"uid": "new_uid", "email": "new@test.com"},
            "token": fake_token,
            "msg": "Account created successfully"
        }

        payload = {
            "email": "new@test.com", 
            "password": "password123", 
            "name": "New User",
            "recaptchaToken": "valid"
        }
        
        response = client.post("/api/auth/signup", json=payload)

        assert response.status_code == 200
        assert response.cookies.get(SESSION_COOKIE_NAME) == fake_token
        mock_signup.assert_called_once()

    @patch("src.server_comps.server.auth_manager.signup", new_callable=AsyncMock)
    def test_signup_existing_email(self, mock_signup, client):
        """Test handling of duplicate email error"""
        mock_signup.side_effect = HTTPException(status_code=409, detail="Email already registered")

        # FIX: Provide full payload so Pydantic validation passes (422 -> 409)
        payload = {
            "email": "exists@test.com",
            "password": "dummy",
            "name": "dummy",
            "recaptchaToken": "dummy"
        }
        response = client.post("/api/auth/signup", json=payload)
        
        assert response.status_code == 409


class TestEmailLogin:
    """Test /api/auth/login-email"""

    @patch("src.server_comps.server.auth_manager.login_email", new_callable=AsyncMock)
    def test_email_login_success(self, mock_login_email, client):
        """Test successful email login"""
        fake_token = "email_session_token"
        mock_login_email.return_value = {
            "user": {"uid": "uid", "email": "test@test.com"},
            "token": fake_token,
            "msg": "Login successful"
        }

        # FIX: Provide full payload (password + recaptcha)
        payload = {
            "email": "test@test.com",
            "password": "correct_password",
            "recaptchaToken": "valid_token"
        }
        response = client.post("/api/auth/login-email", json=payload)

        assert response.status_code == 200
        assert response.cookies.get(SESSION_COOKIE_NAME) == fake_token
        mock_login_email.assert_called_once()

    @patch("src.server_comps.server.auth_manager.login_email", new_callable=AsyncMock)
    def test_email_login_failure(self, mock_login_email, client):
        """Test invalid credentials"""
        mock_login_email.side_effect = HTTPException(status_code=401, detail="Invalid email or password")

        # FIX: Provide full payload
        payload = {
            "email": "test@test.com",
            "password": "wrong_password",
            "recaptchaToken": "valid_token"
        }
        response = client.post("/api/auth/login-email", json=payload)
        
        assert response.status_code == 401


class TestLogout:
    """Test /api/auth/logout"""

    @patch("src.server_comps.server.auth_manager.logout", new_callable=AsyncMock)
    def test_logout(self, mock_logout, client):
        """Test logout clears cookie and calls manager"""
        # Set a cookie to simulate being logged in
        client.cookies.set(SESSION_COOKIE_NAME, "old_token")
        
        # Mock manager returning the UID of the logged out user
        mock_logout.return_value = "uid_123"

        response = client.post("/api/auth/logout", json={"email": "test@test.com"})

        assert response.status_code == 200
        
        # Verify cookie is cleared (FastAPI TestClient represents deletion as empty/expired)
        assert SESSION_COOKIE_NAME not in response.cookies or response.cookies[SESSION_COOKIE_NAME] == ""
        
        # Verify manager was called with the token from the cookie
        mock_logout.assert_called_once_with("old_token")


class TestAuthMe:
    """
    Test /api/auth/me.
    """

    @patch("src.server_comps.server.is_admin", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_me_success(self, mock_get_session, mock_is_admin, client):
        """Test retrieving current user session"""
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        
        # Mock Session Data
        mock_get_session.return_value = {
            "uid": "uid_123",
            "name": "Test User",
            "email": "test@test.com",
            "expires": str((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp())
        }
        mock_is_admin.return_value = False

        response = client.get("/api/auth/me")

        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == "test@test.com"
        assert data["user"]["is_admin"] is False

    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_me_no_cookie(self, mock_get_session, client):
        """Test /me without a cookie"""
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    @patch("src.server_comps.server.delete_session", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_me_expired_session(self, mock_get_session, mock_delete_session, client):
        """Test /me with an expired session"""
        client.cookies.set(SESSION_COOKIE_NAME, "expired_token")
        
        # Mock Expired Timestamp
        expired_time = (datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()
        
        mock_get_session.return_value = {
            "uid": "uid_123",
            "expires": str(expired_time)
        }

        response = client.get("/api/auth/me")
        
        assert response.status_code == 401
        assert "Session expired" in response.json()["detail"]
        
        # Verify that delete_session was called
        mock_delete_session.assert_called_once_with("expired_token")