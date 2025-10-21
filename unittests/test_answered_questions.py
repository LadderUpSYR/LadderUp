import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock, AsyncMock
import sys
import os
from datetime import datetime, timedelta, timezone

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock Firebase before importing the app
mock_cred = Mock()
mock_firestore = Mock()
mock_storage = Mock()

with patch('firebase_admin.credentials.Certificate', return_value=mock_cred):
    with patch('firebase_admin.initialize_app'):
        with patch('firebase_admin.firestore.client', return_value=mock_firestore):
            with patch('firebase_admin.storage.bucket', return_value=mock_storage):
                # Set required environment variables
                os.environ['FIREBASE_SERVICE_ACCOUNT_KEY'] = '{"type": "service_account"}'
                os.environ['GOOGLE_CLIENT_ID'] = 'test-client-id'
                
                from src.server.server import app, SESSION_COOKIE_NAME

client = TestClient(app)


class TestSubmitAnswer:
    """Test the /api/question/submit endpoint"""
    
    def _get_session_data(self, uid="test-uid-123"):
        """Helper to create test session data"""
        return {
            "uid": uid,
            "name": "Test User",
            "email": "test@example.com",
            "expires": str((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
        }
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    @patch("src.server.server.db")
    def test_submit_answer_new_question(self, mock_db, mock_get_session):
        """Test submitting an answer to a new question"""
        session_token = "test-session-token"
        mock_get_session.return_value = self._get_session_data()
        
        # Mock Firestore to return user with no answered questions
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "email": "test@example.com",
            "name": "Test User",
            "answered_questions": []
        }
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.post(
            "/api/question/submit",
            json={
                "questionId": "q1",
                "question": "Tell me about yourself",
                "answer": "I am a software engineer with 5 years of experience",
                "score": 8.5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "Answer submitted successfully"
        assert data["total_answered"] == 1
        assert data["answer_record"]["questionId"] == "q1"
        assert data["answer_record"]["score"] == 8.5
        
        # Verify Firestore update was called
        mock_user_ref.update.assert_called_once()
        update_call = mock_user_ref.update.call_args[0][0]
        assert "answered_questions" in update_call
        assert len(update_call["answered_questions"]) == 1
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    @patch("src.server.server.db")
    def test_submit_answer_update_existing(self, mock_db, mock_get_session):
        """Test updating an answer to a previously answered question"""
        session_token = "test-session-token"
        mock_get_session.return_value = self._get_session_data()
        
        # Mock Firestore to return user with existing answered question
        existing_answer = {
            "questionId": "q1",
            "question": "Tell me about yourself",
            "answer": "Old answer",
            "score": 6.0,
            "date": "2025-01-01T00:00:00Z"
        }
        
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "email": "test@example.com",
            "name": "Test User",
            "answered_questions": [existing_answer]
        }
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.post(
            "/api/question/submit",
            json={
                "questionId": "q1",
                "question": "Tell me about yourself",
                "answer": "New improved answer",
                "score": 9.0
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "Answer submitted successfully"
        assert data["total_answered"] == 1  # Still just one question
        assert data["answer_record"]["score"] == 9.0  # Updated score
        
        # Verify the answer was updated, not duplicated
        update_call = mock_user_ref.update.call_args[0][0]
        assert len(update_call["answered_questions"]) == 1
        assert update_call["answered_questions"][0]["score"] == 9.0
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    def test_submit_answer_not_authenticated(self, mock_get_session):
        """Test that submitting without authentication fails"""
        mock_get_session.return_value = None
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "invalid-token")
        
        response = client.post(
            "/api/question/submit",
            json={
                "questionId": "q1",
                "question": "Test question",
                "answer": "Test answer",
                "score": 8.0
            }
        )
        
        assert response.status_code == 401
        assert "Invalid or expired session" in response.json()["detail"]
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    def test_submit_answer_invalid_score(self, mock_get_session):
        """Test that invalid scores are rejected"""
        session_token = "test-session-token"
        mock_get_session.return_value = self._get_session_data()
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        # Test score too high
        response = client.post(
            "/api/question/submit",
            json={
                "questionId": "q1",
                "question": "Test question",
                "answer": "Test answer",
                "score": 15.0
            }
        )
        
        assert response.status_code == 400
        assert "Score must be between 0 and 10" in response.json()["detail"]
        
        # Test negative score
        response = client.post(
            "/api/question/submit",
            json={
                "questionId": "q1",
                "question": "Test question",
                "answer": "Test answer",
                "score": -1.0
            }
        )
        
        assert response.status_code == 400
        assert "Score must be between 0 and 10" in response.json()["detail"]
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    @patch("src.server.server.db")
    def test_submit_answer_missing_fields(self, mock_db, mock_get_session):
        """Test that missing required fields are rejected"""
        session_token = "test-session-token"
        mock_get_session.return_value = self._get_session_data()
        
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "answered_questions": []
        }
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.post(
            "/api/question/submit",
            json={
                "questionId": "q1",
                "question": "",  # Empty question
                "answer": "Test answer",
                "score": 8.0
            }
        )
        
        assert response.status_code == 400
        assert "Question and answer are required" in response.json()["detail"]


class TestGetAnsweredQuestions:
    """Test the /api/profile/answered-questions endpoint"""
    
    def _get_session_data(self, uid="test-uid-123"):
        """Helper to create test session data"""
        return {
            "uid": uid,
            "name": "Test User",
            "email": "test@example.com",
            "expires": str((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
        }
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    @patch("src.server.server.db")
    def test_get_answered_questions_success(self, mock_db, mock_get_session):
        """Test successfully retrieving answered questions"""
        session_token = "test-session-token"
        mock_get_session.return_value = self._get_session_data()
        
        # Mock Firestore to return user with answered questions
        answered_questions = [
            {
                "questionId": "q1",
                "question": "Tell me about yourself",
                "answer": "I am a software engineer",
                "score": 8.5,
                "date": "2025-10-19T10:00:00Z"
            },
            {
                "questionId": "q2",
                "question": "What are your strengths?",
                "answer": "Problem solving and teamwork",
                "score": 9.0,
                "date": "2025-10-20T12:00:00Z"
            }
        ]
        
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "email": "test@example.com",
            "name": "Test User",
            "answered_questions": answered_questions
        }
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.get("/api/profile/answered-questions")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_answered"] == 2
        assert data["average_score"] == 8.75
        assert len(data["answered_questions"]) == 2
        # Most recent should be first
        assert data["answered_questions"][0]["questionId"] == "q2"
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    @patch("src.server.server.db")
    def test_get_answered_questions_empty(self, mock_db, mock_get_session):
        """Test retrieving answered questions when none exist"""
        session_token = "test-session-token"
        mock_get_session.return_value = self._get_session_data()
        
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {
            "uid": "test-uid-123",
            "email": "test@example.com",
            "name": "Test User",
            "answered_questions": []
        }
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.get("/api/profile/answered-questions")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_answered"] == 0
        assert data["average_score"] == 0
        assert len(data["answered_questions"]) == 0
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    def test_get_answered_questions_not_authenticated(self, mock_get_session):
        """Test that getting answered questions without authentication fails"""
        mock_get_session.return_value = None
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, "invalid-token")
        
        response = client.get("/api/profile/answered-questions")
        
        assert response.status_code == 401
        assert "Invalid or expired session" in response.json()["detail"]
    
    @patch("src.server.server.get_session", new_callable=AsyncMock)
    @patch("src.server.server.db")
    def test_get_answered_questions_user_not_found(self, mock_db, mock_get_session):
        """Test that a 404 is returned when user doesn't exist"""
        session_token = "test-session-token"
        mock_get_session.return_value = self._get_session_data()
        
        mock_user_doc = MagicMock()
        mock_user_doc.exists = False
        
        mock_user_ref = MagicMock()
        mock_user_ref.get.return_value = mock_user_doc
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE_NAME, session_token)
        
        response = client.get("/api/profile/answered-questions")
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]
