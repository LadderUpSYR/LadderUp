"""
Unit tests for the signup endpoint
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

# Add the parent directory to the path so we can import the server
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server.server import app, sessions, hash_password, verify_password

client = TestClient(app)


class TestPasswordHashing:
    """Test password hashing utilities"""
    
    def test_hash_password(self):
        """Test that password hashing works"""
        password = "testpassword123"
        hashed = hash_password(password)
        
        assert hashed is not None
        assert len(hashed) == 64  # SHA-256 produces 64 hex characters
        assert hashed != password
    
    def test_verify_password_correct(self):
        """Test that password verification works with correct password"""
        password = "testpassword123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self):
        """Test that password verification fails with incorrect password"""
        password = "testpassword123"
        hashed = hash_password(password)
        
        assert verify_password("wrongpassword", hashed) is False
    
    def test_same_password_same_hash(self):
        """Test that the same password always produces the same hash"""
        password = "testpassword123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        assert hash1 == hash2


class TestSignupEndpoint:
    """Test the signup endpoint"""
    
    def setup_method(self):
        """Clear sessions before each test"""
        sessions.clear()
    
    @patch("src.server.server.db")
    def test_signup_success(self, mock_db):
        """Test successful user signup"""
        # Mock Firestore to return no existing users
        mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = []
        
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
        assert "session_token" in response.cookies
        
        # Verify Firestore was called to create user
        mock_db.collection.assert_called_with("users")
        assert mock_db.collection.return_value.document.return_value.set.called
    
    @patch("src.server.server.db")
    def test_signup_duplicate_email(self, mock_db):
        """Test that duplicate email returns error"""
        # Mock Firestore to return an existing user
        mock_user = MagicMock()
        mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = [mock_user]
        
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
    
    def test_signup_invalid_email(self):
        """Test that invalid email returns error"""
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
    
    def test_signup_short_password(self):
        """Test that short password returns error"""
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
    
    def test_signup_short_name(self):
        """Test that short name returns error"""
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
    
    @patch("src.server.server.db")
    def test_signup_creates_user_in_db(self, mock_db):
        """Test that signup actually creates user in Firestore"""
        # Mock Firestore to return no existing users
        mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = []
        
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
        
        # Verify Firestore set was called with correct data
        set_call = mock_db.collection.return_value.document.return_value.set
        assert set_call.called
        
        user_data = set_call.call_args[0][0]
        assert user_data["email"] == "test@example.com"
        assert user_data["name"] == "Test User"
        assert user_data["auth_provider"] == "email"
        assert "password_hash" in user_data
        assert "created_at" in user_data
        assert user_data["uid"] == uid


class TestEmailLoginEndpoint:
    """Test the email/password login endpoint"""
    
    def setup_method(self):
        """Clear sessions before each test"""
        sessions.clear()
    
    @patch("src.server.server.db")
    def test_login_success(self, mock_db):
        """Test successful login with email and password"""
        test_email = "test@example.com"
        test_password = "password123"
        password_hash = hash_password(test_password)
        
        # Mock Firestore to return a user
        mock_user_doc = MagicMock()
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "email": test_email,
            "name": "Test User",
            "password_hash": password_hash,
            "auth_provider": "email"
        }
        mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = [mock_user_doc]
        
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
        assert "session_token" in login_response.cookies
    
    @patch("src.server.server.db")
    def test_login_wrong_password(self, mock_db):
        """Test login fails with wrong password"""
        test_email = "test@example.com"
        password_hash = hash_password("correctpassword")
        
        # Mock Firestore to return a user
        mock_user_doc = MagicMock()
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "email": test_email,
            "name": "Test User",
            "password_hash": password_hash,
            "auth_provider": "email"
        }
        mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = [mock_user_doc]
        
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
    
    @patch("src.server.server.db")
    def test_login_nonexistent_user(self, mock_db):
        """Test login fails for non-existent user"""
        # Mock Firestore to return no users
        mock_db.collection.return_value.where.return_value.limit.return_value.stream.return_value = []
        
        response = client.post(
            "/api/auth/login-email",
            json={
                "email": "nonexistent@example.com",
                "password": "password123"
            }
        )
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
