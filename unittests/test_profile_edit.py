"""
Unit tests for profile editing and password change endpoints.
Updated to test the Controller Layer by mocking Manager Singletons.
"""
import sys
import os
from unittest.mock import MagicMock, AsyncMock

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
sys.modules["src.database"] = mock_db_module # Safety catch for different import paths

"""
Unit tests for profile editing and password change endpoints.
Updated to test the Controller Layer by mocking Manager Singletons.
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from unittest.mock import patch
from datetime import datetime, timedelta, timezone

# Add the parent directory to the path so we can import the server
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Now we can safely import app, because database.py is already mocked!
from src.server_comps.server import app, SESSION_COOKIE_NAME


class TestProfileEdit:
    """Test the /api/profile/edit endpoint"""
    
    def _get_session_data(self, uid="test-uid-123", name="Test User", email="test@example.com"):
        return {
            "uid": uid,
            "name": name,
            "email": email,
            "expires": str((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
        }
    
    @patch("src.server_comps.server.profile_manager.update_profile", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_edit_profile_success(self, mock_get_session, mock_update_profile):
        """Test successful profile name update delegation"""
        session_token = "test-session-token"
        session_data = self._get_session_data()
        
        # Mock Session
        mock_get_session.return_value = session_data
        
        # Mock Manager Response
        expected_response = {"uid": "test-uid-123", "name": "Updated Name", "email": "test@example.com"}
        mock_update_profile.return_value = expected_response
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.put(
            "/api/profile/edit",
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "Profile updated successfully"
        assert data["user"] == expected_response
        
        # Verify call to manager
        mock_update_profile.assert_called_once_with("test-uid-123", "Updated Name", session_token, session_data)

    def test_edit_profile_not_authenticated(self):
        """Test that editing profile without authentication fails"""
        client = TestClient(app)
        response = client.put("/api/profile/edit", json={"name": "Updated Name"})
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_edit_profile_invalid_session(self, mock_get_session):
        """Test that editing profile with invalid session fails"""
        mock_get_session.return_value = None
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "invalid-token")
        response = client.put("/api/profile/edit", json={"name": "Updated Name"})
        assert response.status_code == 401

    @patch("src.server_comps.server.profile_manager.update_profile", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_edit_profile_manager_error(self, mock_get_session, mock_update_profile):
        """Test that Manager errors are caught and returned as 500"""
        mock_get_session.return_value = self._get_session_data()
        mock_update_profile.side_effect = Exception("Internal Logic Error")
        
        # FIX: Set raise_server_exceptions=False so the client returns 500 instead of crashing
        client = TestClient(app, raise_server_exceptions=False)
        client.cookies.set(SESSION_COOKIE_NAME, "test-token")
        
        response = client.put(
            "/api/profile/edit",
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 500 


class TestChangePassword:
    """Test the /api/profile/change-password endpoint"""
    
    def _get_session_data(self):
        return {
            "uid": "test-uid-123",
            "name": "Test User",
            "email": "test@example.com",
            "expires": str((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
        }

    @patch("src.server_comps.server.profile_manager.change_password", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_change_password_success(self, mock_get_session, mock_change_password):
        """Test successful password change delegation"""
        mock_get_session.return_value = self._get_session_data()
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "token")
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "newpassword123"}
        )
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Password updated successfully"
        
        mock_change_password.assert_called_once_with("test-uid-123", "newpassword123")

    @patch("src.server_comps.server.profile_manager.change_password", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_change_password_logic_rejection(self, mock_get_session, mock_change_password):
        """Test that manager rejections (e.g. OAuth) return correct status codes"""
        mock_get_session.return_value = self._get_session_data()
        mock_change_password.side_effect = HTTPException(status_code=400, detail="Cannot change password for OAuth accounts")
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "token")
        
        response = client.put(
            "/api/profile/change-password",
            json={"password": "any"}
        )
        
        assert response.status_code == 400
        assert "Cannot change password" in response.json()["detail"]

    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_change_password_not_authenticated(self, mock_get_session):
        mock_get_session.return_value = None
        client = TestClient(app)
        response = client.put("/api/profile/change-password", json={"password": "123"})
        assert response.status_code == 401


class TestDeleteAccount:
    """Test the /api/auth/delete-account endpoint"""
    
    @patch("src.server_comps.server.profile_manager.delete_account", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_delete_account_success(self, mock_get_session, mock_delete_account):
        """Test successful account deletion delegation"""
        session_token = "test-session-token"
        mock_get_session.return_value = {
            "uid": "test-uid-123",
            "expires": str((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
        }
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.delete("/api/auth/delete-account")
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Account deleted successfully"
        
        mock_delete_account.assert_called_once_with("test-uid-123", session_token)

    @patch("src.server_comps.server.profile_manager.delete_account", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_delete_account_error(self, mock_get_session, mock_delete_account):
        mock_get_session.return_value = {"uid": "123", "expires": "9999999999"}
        mock_delete_account.side_effect = Exception("DB Error")
        
        # FIX: Set raise_server_exceptions=False so the client returns 500 instead of crashing
        client = TestClient(app, raise_server_exceptions=False)
        client.cookies.set(SESSION_COOKIE_NAME, "token")
        
        response = client.delete("/api/auth/delete-account")
        
        assert response.status_code == 500