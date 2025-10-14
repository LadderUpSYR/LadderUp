"""
Unit tests for the signup endpoint
"""
import os, sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
import pytest

# Ensure src is in sys.path
SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

# import load app with env
from .test_auth_login import load_app_with_env  # or define _load_app_with_env() in this file


class TestPasswordHashing:
    """Test password hashing utilities"""
    
    def test_hash_password(self, load_app_with_env):
        """Test that password hashing works"""
        appmod, client, fakedb = load_app_with_env
        password = "testpassword123"
        hashed = appmod.hash_password(password)
        
        assert hashed is not None
        assert len(hashed) == 64  # SHA-256 produces 64 hex characters
        assert hashed != password
    
    def test_verify_password_correct(self, load_app_with_env):
        """Test that password verification works with correct password"""
        appmod, client, fakedb = load_app_with_env
        password = "testpassword123"
        hashed = appmod.hash_password(password)
        
        assert appmod.verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self, load_app_with_env):
        """Test that password verification fails with incorrect password"""
        appmod, client, fakedb = load_app_with_env
        password = "testpassword123"
        hashed = appmod.hash_password(password)
        
        assert appmod.verify_password("wrongpassword", hashed) is False
    
    def test_same_password_same_hash(self, load_app_with_env):
        """Test that the same password always produces the same hash"""
        appmod, client, fakedb = load_app_with_env
        password = "testpassword123"
        hash1 = appmod.hash_password(password)
        hash2 = appmod.hash_password(password)
        
        assert hash1 == hash2


class TestSignupEndpoint:
    """Test the signup endpoint"""
    
    def test_signup_success(self, load_app_with_env):
        """Test successful user signup"""
        appmod, client, fakedb = load_app_with_env
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "test@example.com",
                "password": "password123",
                "name": "Test User"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "user" in data
        assert data["user"]["email"] == "test@example.com"
        assert data["user"]["name"] == "Test User"
        assert "uid" in data["user"]
        assert data["msg"] == "Account created successfully"
        
        # Check that session cookie was set
        assert appmod.SESSION_COOKIE_NAME in response.cookies
        
        # Verify user was added to fake db
        uid = data["user"]["uid"]
        assert uid in fakedb.users
        assert fakedb.users[uid]["email"] == "test@example.com"
    
    def test_signup_duplicate_email(self, load_app_with_env):
        """Test that duplicate email returns error"""
        appmod, client, fakedb = load_app_with_env
        
        # Add existing user to fake db
        fakedb.users["existing-uid"] = {
            "uid": "existing-uid",
            "email": "existing@example.com",
            "name": "Existing User",
            "password_hash": "somehash"
        }
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "existing@example.com",
                "password": "password123",
                "name": "Test User"
            }
        )
        
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"].lower()
    
    def test_signup_invalid_email(self, load_app_with_env):
        """Test that invalid email returns error"""
        appmod, client, fakedb = load_app_with_env
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "notanemail",
                "password": "password123",
                "name": "Test User"
            }
        )
        
        assert response.status_code == 400
        assert "email" in response.json()["detail"].lower()
    
    def test_signup_short_password(self, load_app_with_env):
        """Test that short password returns error"""
        appmod, client, fakedb = load_app_with_env
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "test@example.com",
                "password": "12345",
                "name": "Test User"
            }
        )
        
        assert response.status_code == 400
        assert "password" in response.json()["detail"].lower()
    
    def test_signup_short_name(self, load_app_with_env):
        """Test that short name returns error"""
        appmod, client, fakedb = load_app_with_env
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "test@example.com",
                "password": "password123",
                "name": "A"
            }
        )
        
        assert response.status_code == 400
        assert "name" in response.json()["detail"].lower()
    
    def test_signup_creates_user_in_db(self, load_app_with_env):
        """Test that signup actually creates user in Firestore"""
        appmod, client, fakedb = load_app_with_env
        
        with patch("src.server.server.redis_client") as mock_redis_client:
            # Set up mocks for success (or just a clean fall-through)
            mock_redis_client.hset = AsyncMock(return_value=True) # Mock hset to succeed
            mock_redis_client.expire = AsyncMock(return_value=True) # Mock expire to succeed
            
            # The test client POST request
            response = client.post(
                "/api/auth/signup",
                json={
                    "email": "test@example.com",
                    "password": "password123",
                    "name": "Test User"
                }
            )
        
        assert response.status_code == 200
        uid = response.json()["user"]["uid"]
        
        # Verify user was created in fake db
        assert uid in fakedb.users
        user_data = fakedb.users[uid]
        
        assert user_data["email"] == "test@example.com"
        assert user_data["name"] == "Test User"
        assert user_data["auth_provider"] == "email"
        assert "password_hash" in user_data
        assert "created_at" in user_data
        assert user_data["uid"] == uid


# note the redis mock manual patch instead of just using appmod / client
class TestEmailLoginEndpoint:
    """Test the email/password login endpoint"""
    
    def test_login_success(self, load_app_with_env):
        """Test successful login with email and password"""
        appmod, client, fakedb = load_app_with_env
        
        test_email = "test@example.com"
        test_password = "password123"
        password_hash = appmod.hash_password(test_password)
        
        # Add user to fake db
        fakedb.users["test-uid-123"] = {
            "uid": "test-uid-123",
            "email": test_email,
            "name": "Test User",
            "password_hash": password_hash,
            "auth_provider": "email"
        }
        
        # Login
        with patch("src.server.server.redis_client") as mock_redis_client:
            # Set up mocks for success (or at least no internal cleanup error)
            mock_redis_client.hset = AsyncMock(return_value=True)
            mock_redis_client.expire = AsyncMock(return_value=True)

            # Login
            login_response = client.post(
                "/api/auth/login-email",
                json={
                    "email": test_email,
                    "password": test_password
                }
            )
        
        assert login_response.status_code == 200
        data = login_response.json()
        
        assert "user" in data
        assert data["user"]["email"] == test_email
        assert data["msg"] == "Login successful"
        
        # Check session cookie
        assert appmod.SESSION_COOKIE_NAME in login_response.cookies
    
    def test_login_wrong_password(self, load_app_with_env):
        """Test login fails with wrong password"""
        appmod, client, fakedb = load_app_with_env
        
        test_email = "test@example.com"
        password_hash = appmod.hash_password("correctpassword")
        
        # Add user to fake db
        fakedb.users["test-uid-123"] = {
            "uid": "test-uid-123",
            "email": test_email,
            "name": "Test User",
            "password_hash": password_hash,
            "auth_provider": "email"
        }
        
        # Try to login with wrong password
        login_response = client.post(
            "/api/auth/login-email",
            json={
                "email": test_email,
                "password": "wrongpassword"
            }
        )
        
        assert login_response.status_code == 401
        assert "invalid" in login_response.json()["detail"].lower()
    
    def test_login_nonexistent_user(self, load_app_with_env):
        """Test login fails for non-existent user"""
        appmod, client, fakedb = load_app_with_env
        
        response = client.post(
            "/api/auth/login-email",
            json={
                "email": "nonexistent@example.com",
                "password": "password123"
            }
        )
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
