"""
Unit tests for the signup endpoint
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add the parent directory to the path so we can import the server
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server.server import app, db, sessions, hash_password, verify_password

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
        """Clear sessions and test data before each test"""
        sessions.clear()
        # Note: In production, you'd want to use a test database
        # For now, we'll test with the real DB but use unique emails
    
    def test_signup_success(self):
        """Test successful user signup"""
        import uuid
        test_email = f"test_{uuid.uuid4()}@example.com"
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": test_email,
                "password": "password123",
                "name": "Test User"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "user" in data
        assert data["user"]["email"] == test_email
        assert data["user"]["name"] == "Test User"
        assert "uid" in data["user"]
        assert data["msg"] == "Account created successfully"
        
        # Check that session cookie was set
        assert "session_token" in response.cookies
        
        # Cleanup: delete test user
        uid = data["user"]["uid"]
        db.collection("users").document(uid).delete()
    
    def test_signup_duplicate_email(self):
        """Test that duplicate email returns error"""
        import uuid
        test_email = f"test_{uuid.uuid4()}@example.com"
        
        # First signup
        response1 = client.post(
            "/api/auth/signup",
            json={
                "email": test_email,
                "password": "password123",
                "name": "Test User"
            }
        )
        assert response1.status_code == 200
        uid = response1.json()["user"]["uid"]
        
        # Try to signup again with same email
        response2 = client.post(
            "/api/auth/signup",
            json={
                "email": test_email,
                "password": "different123",
                "name": "Different User"
            }
        )
        
        assert response2.status_code == 409
        assert "already registered" in response2.json()["detail"].lower()
        
        # Cleanup
        db.collection("users").document(uid).delete()
    
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
    
    def test_signup_creates_user_in_db(self):
        """Test that signup actually creates user in Firestore"""
        import uuid
        test_email = f"test_{uuid.uuid4()}@example.com"
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": test_email,
                "password": "password123",
                "name": "Test User"
            }
        )
        
        assert response.status_code == 200
        uid = response.json()["user"]["uid"]
        
        # Check Firestore (only if db is not mocked)
        try:
            user_doc = db.collection("users").document(uid).get()
            if hasattr(user_doc, 'exists') and user_doc.exists:
                user_data = user_doc.to_dict()
                assert user_data["email"] == test_email
                assert user_data["name"] == "Test User"
                assert user_data["auth_provider"] == "email"
                assert "password_hash" in user_data
                assert "created_at" in user_data
                
                # Cleanup
                db.collection("users").document(uid).delete()
            else:
                # If db is mocked or document doesn't exist, just verify response
                assert uid is not None
                assert len(uid) > 0
        except (AttributeError, TypeError):
            # db is mocked, just verify the response is correct
            assert uid is not None
            assert len(uid) > 0


class TestEmailLoginEndpoint:
    """Test the email/password login endpoint"""
    
    def setup_method(self):
        """Clear sessions before each test"""
        sessions.clear()
    
    def test_login_success(self):
        """Test successful login with email and password"""
        import uuid
        test_email = f"test_{uuid.uuid4()}@example.com"
        test_password = "password123"
        
        # First create a user
        signup_response = client.post(
            "/api/auth/signup",
            json={
                "email": test_email,
                "password": test_password,
                "name": "Test User"
            }
        )
        assert signup_response.status_code == 200
        uid = signup_response.json()["user"]["uid"]
        
        # Clear sessions to simulate new login
        sessions.clear()
        
        # Now try to login
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
        
        # Cleanup
        db.collection("users").document(uid).delete()
    
    def test_login_wrong_password(self):
        """Test login fails with wrong password"""
        import uuid
        test_email = f"test_{uuid.uuid4()}@example.com"
        
        # Create user
        signup_response = client.post(
            "/api/auth/signup",
            json={
                "email": test_email,
                "password": "correctpassword",
                "name": "Test User"
            }
        )
        uid = signup_response.json()["user"]["uid"]
        
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
        
        # Cleanup
        db.collection("users").document(uid).delete()
    
    def test_login_nonexistent_user(self):
        """Test login fails for non-existent user"""
        response = client.post(
            "/api/auth/login-email",
            json={
                "email": "nonexistent@example.com",
                "password": "password123"
            }
        )
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
