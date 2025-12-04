"""
Unit tests for profile editing, password changes, and question interactions.
Refactored to mock Managers/Middleware and use fresh TestClients.
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

# Inject mocks into sys.modules to intercept imports in server.py
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

class TestProfileEdit:
    """Test the /api/profile/edit endpoint"""
    
    def _get_session_data(self):
        return {
            "uid": "test-uid-123",
            "name": "Test User",
            "email": "test@example.com",
            "expires": "9999999999"
        }
    
    @patch("src.server_comps.server.profile_manager.update_profile", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_edit_profile_success(self, mock_get_session, mock_update_profile, client):
        """Test successful profile name update delegation"""
        session_data = self._get_session_data()
        
        # 1. Mock Session
        mock_get_session.return_value = session_data
        
        # 2. Mock Manager Response
        expected_response = {"uid": "test-uid-123", "name": "Updated Name", "email": "test@example.com"}
        mock_update_profile.return_value = expected_response
        
        # 3. Execute
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.put(
            "/api/profile/edit",
            json={"name": "Updated Name"}
        )
        
        # 4. Assert
        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "Profile updated successfully"
        assert data["user"] == expected_response
        
        # Verify call to manager includes the session token/data
        mock_update_profile.assert_called_once_with("test-uid-123", "Updated Name", "valid_token", session_data)

    def test_edit_profile_not_authenticated(self, client):
        """Test that editing profile without authentication fails"""
        response = client.put("/api/profile/edit", json={"name": "Updated Name"})
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    @patch("src.server_comps.server.profile_manager.update_profile", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_edit_profile_manager_error(self, mock_get_session, mock_update_profile, client):
        """Test that Manager errors are caught and returned as 500"""
        mock_get_session.return_value = self._get_session_data()
        mock_update_profile.side_effect = Exception("Internal Logic Error")
        
        # Use raise_server_exceptions=False to prevent test client crash
        client = TestClient(app, raise_server_exceptions=False)
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        
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
            "expires": "9999999999"
        }

    @patch("src.server_comps.server.profile_manager.change_password", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_change_password_success(self, mock_get_session, mock_change_password, client):
        """Test successful password change delegation"""
        mock_get_session.return_value = self._get_session_data()
        
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.put(
            "/api/profile/change-password",
            json={"password": "newpassword123"}
        )
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Password updated successfully"
        
        mock_change_password.assert_called_once_with("test-uid-123", "newpassword123")

    @patch("src.server_comps.server.profile_manager.change_password", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_change_password_logic_rejection(self, mock_get_session, mock_change_password, client):
        """Test that manager rejections (e.g. OAuth users) return correct status codes"""
        mock_get_session.return_value = self._get_session_data()
        
        # Simulate Manager rejecting the request
        mock_change_password.side_effect = HTTPException(status_code=400, detail="Cannot change password for OAuth accounts")
        
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.put(
            "/api/profile/change-password",
            json={"password": "any"}
        )
        
        assert response.status_code == 400
        assert "Cannot change password" in response.json()["detail"]

    def test_change_password_not_authenticated(self, client):
        """Test no auth"""
        response = client.put("/api/profile/change-password", json={"password": "123"})
        assert response.status_code == 401


class TestDeleteAccount:
    """Test the /api/auth/delete-account endpoint"""
    
    @patch("src.server_comps.server.profile_manager.delete_account", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_delete_account_success(self, mock_get_session, mock_delete_account, client):
        """Test successful account deletion delegation"""
        mock_get_session.return_value = {"uid": "test-uid-123", "expires": "9999999999"}
        
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.delete("/api/auth/delete-account")
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Account deleted successfully"
        
        mock_delete_account.assert_called_once_with("test-uid-123", "valid_token")

    @patch("src.server_comps.server.profile_manager.delete_account", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_delete_account_error(self, mock_get_session, mock_delete_account, client):
        """Test generic error during deletion"""
        mock_get_session.return_value = {"uid": "123", "expires": "9999999999"}
        mock_delete_account.side_effect = Exception("DB Error")
        
        client = TestClient(app, raise_server_exceptions=False)
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        
        response = client.delete("/api/auth/delete-account")
        assert response.status_code == 500


class TestGetAnsweredQuestions:
    """Test the /api/profile/answered-questions endpoint"""
    
    @patch("src.server_comps.server.profile_manager.get_answered_questions", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_get_answered_questions_success(self, mock_get_session, mock_get_questions, client):
        """Test fetching answered questions via Manager"""
        mock_get_session.return_value = {"uid": "test-uid-123", "expires": "9999999999"}
        
        mock_data = {
            "answered_questions": [{"id": "q1", "score": 10}],
            "total_answered": 1,
            "average_score": 10.0
        }
        mock_get_questions.return_value = mock_data
        
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.get("/api/profile/answered-questions")
        
        assert response.status_code == 200
        assert response.json() == mock_data
        mock_get_questions.assert_called_once_with("test-uid-123")

    def test_get_answered_questions_no_auth(self, client):
        """Test no auth"""
        response = client.get("/api/profile/answered-questions")
        assert response.status_code == 401


class TestSubmitAnswer:
    """Test the /api/question/submit endpoint"""
    
    @patch("src.server_comps.server.answer_to_db_middleware", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_submit_answer_success(self, mock_get_session, mock_middleware, client):
        """
        Test submitting an answer.
        Note: The controller calls 'answer_to_db_middleware' AND accesses DB for stats.
        We mock the middleware for the logic, and the global 'mock_db_module' for the stats count.
        """
        # 1. Mock Session
        mock_get_session.return_value = {"uid": "test-uid-123", "expires": "9999999999"}
        
        # 2. Mock Middleware Result (The grading logic)
        mock_middleware.return_value = {
            "score": 9.0,
            "feedback": "Great job",
            "strengths": ["Clear"],
            "improvements": ["None"]
        }
        
        # 3. Mock the side-effect DB call in the controller (counting total answered)
        # The controller does: user_ref.get().to_dict().get("answered_questions")
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "answered_questions": ["a1", "a2"] # list of length 2
        }
        mock_db_module.db.collection.return_value.document.return_value.get.return_value = mock_user_doc

        # 4. Execute
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.post(
            "/api/question/submit",
            json={
                "questionId": "q1",
                "question": "Who are you?",
                "answer": "I am a test."
            }
        )
        
        # 5. Assert
        assert response.status_code == 200
        data = response.json()
        
        assert data["msg"] == "Answer submitted and graded successfully"
        assert data["grading"]["score"] == 9.0
        assert data["total_answered"] == 2 # Derived from our DB mock

        # Verify Middleware was called with correct args
        mock_middleware.assert_called_once_with(
            answer="I am a test.",
            question_id="q1",
            player_uuid="test-uid-123"
        )

    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_submit_answer_missing_fields(self, mock_get_session, client):
        """Test validation for missing questionId or answer"""
        mock_get_session.return_value = {"uid": "test-uid-123", "expires": "999"}
        
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        
        # Case 1: Empty Answer
        response = client.post(
            "/api/question/submit",
            json={"questionId": "q1", "question": "Test", "answer": ""}
        )
        assert response.status_code == 400
        assert "Question ID and answer are required" in response.json()["detail"]
        
        # Case 2: Empty Question ID
        response = client.post(
            "/api/question/submit",
            json={"answer": "Test", "question": "Test", "questionId": ""}
        )
        assert response.status_code == 400
        assert "Question ID and answer are required" in response.json()["detail"]