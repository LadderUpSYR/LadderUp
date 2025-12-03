"""
Unit tests for profile data retrieval.
Tests the Controller Layer by mocking Manager Singletons.
"""
import sys
import os
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timedelta, timezone

# --- CRITICAL FIX: MOCK DATABASE BEFORE IMPORTING SERVER ---
# 1. Create a fake database module
mock_db_module = MagicMock()
mock_db_module.db = MagicMock()
mock_db_module.redis_client = MagicMock()
mock_db_module.bucket = MagicMock()
mock_db_module.SESSION_COOKIE_NAME = "__session"
mock_db_module.SESSION_TTL_SECONDS = 3600

# 2. Add async helpers
mock_db_module.store_session = AsyncMock()
mock_db_module.get_session = AsyncMock()
mock_db_module.delete_session = AsyncMock()
mock_db_module.build_session_payload = MagicMock()

# 3. Inject this fake module into sys.modules
sys.modules["src.server_comps.database"] = mock_db_module
sys.modules["src.database"] = mock_db_module

# --- END CRITICAL FIX ---

from fastapi.testclient import TestClient
from fastapi import HTTPException

# Add the parent directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server_comps.server import app, SESSION_COOKIE_NAME


class TestProfileData:
    """Test data retrieval endpoints like /me and /answered-questions"""

    def _get_session_data(self, uid="user123", name="ProfileTester", email="prof@test.com"):
        return {
            "uid": uid,
            "name": name,
            "email": email,
            "expires": str((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
        }

    @patch("src.server_comps.server.profile_manager.get_answered_questions", new_callable=AsyncMock)
    @patch("src.server_comps.server.is_admin", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_profilepage_shows_user_with_answered_question(self, mock_get_session, mock_is_admin, mock_get_questions):
        """
        Simulate a user who is logged in and verifies:
        1. /api/auth/me returns basic user info
        2. /api/profile/answered-questions returns the question list
        """
        
        # --- SETUP MOCK DATA ---
        fake_uid = "user123"
        fake_profile = {
            "name": "ProfileTester",
            "email": "prof@test.com",
            "is_admin": False
        }
        
        fake_questions_response = {
            "answered_questions": [
                {
                    "questionId": 2,
                    "question": "Where do you see yourself in five years?",
                    "answer": "Leading product at a mission-driven org",
                    "score": 4,
                    "date": "2025-10-05"
                }
            ],
            "total_answered": 1,
            "average_score": 4.0
        }

        # --- CONFIGURE MOCKS ---
        # 1. Simulate active session
        mock_get_session.return_value = self._get_session_data(
            uid=fake_uid, 
            name=fake_profile["name"], 
            email=fake_profile["email"]
        )
        
        # 2. Simulate User is NOT admin
        mock_is_admin.return_value = False
        
        # 3. Simulate ProfileManager returning the questions
        mock_get_questions.return_value = fake_questions_response

        # --- EXECUTE TESTS ---
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "valid-token")

        # Step 1: Check /api/auth/me
        r_me = client.get("/api/auth/me")
        assert r_me.status_code == 200
        me_data = r_me.json()["user"]
        
        assert me_data["uid"] == fake_uid
        assert me_data["name"] == fake_profile["name"]
        assert me_data["email"] == fake_profile["email"]
        assert me_data["is_admin"] is False

        # Step 2: Check /api/profile/answered-questions
        r_questions = client.get("/api/profile/answered-questions")
        assert r_questions.status_code == 200
        q_data = r_questions.json()
        
        # Verify the endpoint returned exactly what the Manager gave it
        assert q_data["total_answered"] == 1
        assert len(q_data["answered_questions"]) == 1
        assert q_data["answered_questions"][0]["questionId"] == 2
        assert q_data["answered_questions"][0]["answer"] == "Leading product at a mission-driven org"

        # --- VERIFY CALLS ---
        # Ensure the controller actually called the Manager with the correct UID
        mock_get_questions.assert_called_once_with(fake_uid)
        mock_is_admin.assert_called_once_with(fake_uid)