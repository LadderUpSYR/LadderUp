"""
Unit tests for question retrieval endpoints.
Tests the Controller Layer by mocking the QuestionManager Singleton.
"""
import sys
import os
from unittest.mock import MagicMock, AsyncMock, patch

# --- CRITICAL FIX: MOCK DATABASE BEFORE IMPORTING SERVER ---
# This prevents "DefaultCredentialsError" by ensuring the database module 
# is mocked before the server tries to load it.

# 1. Create a fake database module
mock_db_module = MagicMock()
mock_db_module.db = MagicMock()
mock_db_module.redis_client = MagicMock()
mock_db_module.bucket = MagicMock()
mock_db_module.SESSION_COOKIE_NAME = "__session"
mock_db_module.SESSION_TTL_SECONDS = 3600

# 2. Add async helpers that server.py expects
mock_db_module.store_session = AsyncMock()
mock_db_module.get_session = AsyncMock()
mock_db_module.delete_session = AsyncMock()
mock_db_module.build_session_payload = MagicMock()

# 3. Inject into sys.modules
sys.modules["src.server_comps.database"] = mock_db_module
sys.modules["src.database"] = mock_db_module

# --- END CRITICAL FIX ---

import pytest
from fastapi.testclient import TestClient

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server_comps.server import app

client = TestClient(app)

class TestQuestionEndpoints:
    
    @patch("src.server_comps.server.question_manager.get_question_by_id", new_callable=AsyncMock)
    def test_get_question_success(self, mock_get_question):
        """Test retrieving a valid question by ID"""
        
        # --- SETUP MOCK DATA ---
        question_id = 2
        fake_question = {
            "answerCriteria": "Could be anything.",
            "avgScore": 1,
            "id": question_id,
            "numAttempts": 0,
            "question": "Where do you see yourself in five years?"
        }
        
        # Configure the Manager Mock to return our fake question
        mock_get_question.return_value = fake_question
        
        # --- EXECUTE REQUEST ---
        # Note: We pass a raw dict. FastAPI automatically validates it against QuestionRequest model.
        response = client.post("/api/question/id", json={"questionId": question_id})
        
        # --- ASSERTIONS ---
        assert response.status_code == 200
        data = response.json()
        
        # Verify the data matches
        assert data["answerCriteria"] == "Could be anything."
        assert data["avgScore"] == 1
        assert data["id"] == 2
        assert data["question"] == "Where do you see yourself in five years?"
        
        # Verify the Controller delegated to the Manager correctly
        mock_get_question.assert_called_once_with(question_id)

    @pytest.mark.parametrize(
        "bad_id, expected_status",
        [
            (-1, 200),        # Valid Integer: Manager returns fallback (200 OK)
            (1000000, 200),   # Valid Integer: Manager returns fallback (200 OK)
            ("fish", 422)     # Invalid Type: FastAPI validation fails (422 Unprocessable Entity)
        ]
    )
    @patch("src.server_comps.server.question_manager.get_question_by_id", new_callable=AsyncMock)
    def test_question_edge_cases(self, mock_get_question, bad_id, expected_status):
        """
        Test edge cases for Question ID.
        - Strings should fail Pydantic validation (422)
        - Non-existent IDs should return the default fallback question (200) from Manager
        """
        
        # Define the fallback that the Manager would return for a "Not Found" case
        default_fallback = {
            "questionId": "default-1",
            "question": "Default Question",
            "avgScore": 1,
            "answerCriteria": "Standard Criteria"
        }
        mock_get_question.return_value = default_fallback

        # Execute Request
        response = client.post("/api/question/id", json={"questionId": bad_id})
        
        # Assertions
        assert response.status_code == expected_status
        
        if expected_status == 200:
            # If it passed validation, verify we got the fallback data
            data = response.json()
            assert data["question"] == "Default Question"
            assert data["avgScore"] == 1
            # Verify manager was called
            mock_get_question.assert_called_once_with(bad_id)
        else:
            # If it failed validation (422), the Manager should NOT have been called
            mock_get_question.assert_not_called()