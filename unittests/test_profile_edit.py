"""
Unit tests for profile editing and password change endpoints
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os
from datetime import datetime, timedelta, timezone

# Add the parent directory to the path so we can import the server
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server.server import app, sessions, hash_password, SESSION_COOKIE_NAME


class TestProfileEdit:
    """Test the /api/profile/edit endpoint"""
    
    def setup_method(self):
        """Clear sessions before each test"""
        sessions.clear()
    
    def _create_test_session(self, uid="test-uid-123", name="Test User", email="test@example.com"):
        """Helper to create a test session"""
        session_token = "test-session-token"
        sessions[session_token] = {
            "uid": uid,
            "name": name,
            "email": email,
            "expires": datetime.now(timezone.utc) + timedelta(days=7)
        }
        return session_token
    
    @patch("src.server.server.db")
    def test_edit_profile_success(self, mock_db):
        """Test successful profile name update"""
        session_token = self._create_test_session()
        
        # Mock Firestore update
        mock_user_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        # Create client and set cookie
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.put(
            "/api/profile/edit",
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["msg"] == "Profile updated successfully"
        assert data["user"]["name"] == "Updated Name"
        assert data["user"]["uid"] == "test-uid-123"
        assert data["user"]["email"] == "test@example.com"
        
        # Verify Firestore update was called
        mock_db.collection.assert_called_with("users")
        mock_db.collection.return_value.document.assert_called_with("test-uid-123")
        mock_user_ref.update.assert_called_once_with({"name": "Updated Name"})
        
        # Verify session was updated
        assert sessions[session_token]["name"] == "Updated Name"
    
    def test_edit_profile_not_authenticated(self):
        """Test that editing profile without authentication fails"""
        client = TestClient(app)
        
        response = client.put(
            "/api/profile/edit",
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    def test_edit_profile_invalid_session(self):
        """Test that editing profile with invalid session fails"""
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "invalid-token")
        
        response = client.put(
            "/api/profile/edit",
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    @patch("src.server.server.db")
    def test_edit_profile_firestore_error(self, mock_db):
        """Test that Firestore errors are handled properly"""
        session_token = self._create_test_session()
        
        # Mock Firestore to raise an exception
        mock_db.collection.return_value.document.return_value.update.side_effect = Exception("Firestore error")
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.put(
            "/api/profile/edit",
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 500
        assert "Failed to update profile" in response.json()["detail"]


class TestChangePassword:
    """Test the /api/profile/change-password endpoint"""
    
    def setup_method(self):
        """Clear sessions before each test"""
        sessions.clear()
    
    def _create_test_session(self, uid="test-uid-123", name="Test User", email="test@example.com"):
        """Helper to create a test session"""
        session_token = "test-session-token"
        sessions[session_token] = {
            "uid": uid,
            "name": name,
            "email": email,
            "expires": datetime.now(timezone.utc) + timedelta(days=7)
        }
        return session_token
    
    @patch("src.server.server.db")
    def test_change_password_success(self, mock_db):
        """Test successful password change for email auth user"""
        session_token = self._create_test_session()
        
        # Mock Firestore to return email auth user
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "email": "test@example.com",
            "name": "Test User",
            "auth_provider": "email",
            "password_hash": hash_password("oldpassword123")
        }
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "newpassword123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "Password updated successfully"
        
        # Verify Firestore was called correctly
        mock_db.collection.assert_called_with("users")
        mock_db.collection.return_value.document.assert_called_with("test-uid-123")
        
        # Verify update was called with hashed password
        assert mock_user_ref.update.called
        update_args = mock_user_ref.update.call_args[0][0]
        assert "password_hash" in update_args
        assert update_args["password_hash"] != "newpassword123"  # Should be hashed
        assert len(update_args["password_hash"]) == 64  # SHA-256 hash length
    
    @patch("src.server.server.db")
    def test_change_password_oauth_user_fails(self, mock_db):
        """Test that OAuth users cannot change password"""
        session_token = self._create_test_session()
        
        # Mock Firestore to return OAuth user
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "email": "test@example.com",
            "name": "Test User",
            "auth_provider": "google"  # OAuth provider
        }
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "newpassword123"}
        )
        
        assert response.status_code == 400
        assert "Cannot change password for OAuth accounts" in response.json()["detail"]
    
    def test_change_password_not_authenticated(self):
        """Test that changing password without authentication fails"""
        client = TestClient(app)
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "newpassword123"}
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    def test_change_password_invalid_session(self):
        """Test that changing password with invalid session fails"""
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "invalid-token")
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "newpassword123"}
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    @patch("src.server.server.db")
    def test_change_password_too_short(self, mock_db):
        """Test that short passwords are rejected"""
        session_token = self._create_test_session()
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "12345"}  # Less than 6 characters
        )
        
        assert response.status_code == 400
        assert "at least 6 characters" in response.json()["detail"]
    
    @patch("src.server.server.db")
    def test_change_password_user_not_found(self, mock_db):
        """Test that changing password fails if user not found in DB"""
        session_token = self._create_test_session()
        
        # Mock Firestore to return non-existent user
        mock_user_doc = MagicMock()
        mock_user_doc.exists = False
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "newpassword123"}
        )
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]
    
    @patch("src.server.server.db")
    def test_change_password_firestore_error(self, mock_db):
        """Test that Firestore errors are handled properly"""
        session_token = self._create_test_session()
        
        # Mock Firestore to raise an exception during get
        mock_user_ref = MagicMock()
        mock_user_ref.get.side_effect = Exception("Firestore error")
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "newpassword123"}
        )
        
        assert response.status_code == 500
        assert "Failed to update password" in response.json()["detail"]


class TestDeleteAccount:
    """Test the /api/auth/delete-account endpoint"""
    
    def setup_method(self):
        """Clear sessions before each test"""
        sessions.clear()
    
    def _create_test_session(self, uid="test-uid-123", name="Test User", email="test@example.com"):
        """Helper to create a test session"""
        session_token = "test-session-token"
        sessions[session_token] = {
            "uid": uid,
            "name": name,
            "email": email,
            "expires": datetime.now(timezone.utc) + timedelta(days=7)
        }
        return session_token
    
    @patch("src.server.server.db")
    def test_delete_account_success(self, mock_db):
        """Test successful account deletion"""
        session_token = self._create_test_session()
        
        # Mock Firestore delete
        mock_user_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.delete("/api/auth/delete-account")
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Account deleted successfully"
        
        # Verify Firestore delete was called
        mock_db.collection.assert_called_with("users")
        mock_db.collection.return_value.document.assert_called_with("test-uid-123")
        mock_user_ref.delete.assert_called_once()
        
        # Verify session was removed
        assert session_token not in sessions
    
    def test_delete_account_not_authenticated(self):
        """Test that deleting account without authentication fails"""
        client = TestClient(app)
        
        response = client.delete("/api/auth/delete-account")
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    def test_delete_account_invalid_session(self):
        """Test that deleting account with invalid session fails"""
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "invalid-token")
        
        response = client.delete("/api/auth/delete-account")
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"
    
    @patch("src.server.server.db")
    def test_delete_account_firestore_error(self, mock_db):
        """Test that Firestore errors are handled properly"""
        session_token = self._create_test_session()
        
        # Mock Firestore to raise an exception
        mock_db.collection.return_value.document.return_value.delete.side_effect = Exception("Firestore error")
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.delete("/api/auth/delete-account")
        
        assert response.status_code == 500
        assert "Failed to delete account" in response.json()["detail"]
