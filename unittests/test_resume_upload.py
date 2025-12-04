"""
Unit tests for resume upload functionality.
Refactored to mock the ProfileManager instead of Firebase directly.
"""
import sys
import os
from unittest.mock import MagicMock, AsyncMock, patch
from io import BytesIO
import pytest
from fastapi.testclient import TestClient

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
sys.modules["src.database"] = mock_db_module

# Add parent directory to path
# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server_comps.server import app, SESSION_COOKIE_NAME

# --- FIX START: Remove global client, add fixture ---
@pytest.fixture
def client():
    """Yields a fresh TestClient for every test case to ensure no cookie leakage."""
    return TestClient(app)
# --- FIX END ---

class TestResumeUpload:
    """Test cases for resume upload functionality via Controller Logic"""

    def _get_session_data(self):
        return {
            "uid": "test_user_123",
            "name": "Test User",
            "email": "test@example.com",
            "expires": "9999999999"
        }

    @patch("src.server_comps.server.profile_manager.upload_resume", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_upload_resume_success(self, mock_get_session, mock_upload_resume, client): # <--- Add client arg
        """Test successful resume upload delegation"""
        
        # 1. Mock Session
        mock_get_session.return_value = self._get_session_data()
        
        # 2. Mock Manager Response
        fake_url = "https://storage.googleapis.com/test-bucket/resumes/test_user_123/resume.pdf"
        mock_upload_resume.return_value = fake_url
        
        # 3. Create Mock PDF
        pdf_content = b"%PDF-1.4 mock pdf content"
        files = {"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")}
        
        # 4. Execute
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.post(
            "/api/profile/upload-resume",
            files=files
        )
        
        # 5. Assert
        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "Resume uploaded successfully"
        assert data["resume_url"] == fake_url

    def test_upload_resume_no_session(self, client): # <--- Add client arg
        """Test resume upload without authentication"""
        # Client is fresh here, so no cookies exist!
        pdf_content = b"%PDF-1.4 mock pdf content"
        files = {"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")}
        
        response = client.post("/api/profile/upload-resume", files=files)
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_upload_resume_invalid_file_type(self, mock_get_session, client): # <--- Add client arg
        """Test resume upload with non-PDF file (Controller Validation)"""
        mock_get_session.return_value = self._get_session_data()
        
        files = {"file": ("resume.txt", BytesIO(b"text content"), "text/plain")}
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        
        response = client.post(
            "/api/profile/upload-resume",
            files=files
        )
        
        assert response.status_code == 400
        assert "Only PDF files" in response.json()["detail"]

    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_upload_resume_file_too_large(self, mock_get_session, client): # <--- Add client arg
        """Test resume upload with file exceeding size limit (Controller Validation)"""
        mock_get_session.return_value = self._get_session_data()
        
        large_content = b"x" * (10 * 1024 * 1024 + 100) 
        files = {"file": ("resume.pdf", BytesIO(large_content), "application/pdf")}
        
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        
        response = client.post(
            "/api/profile/upload-resume",
            files=files
        )
        
        assert response.status_code == 400
        assert "File size must be less than 10MB" in response.json()["detail"]

    @patch("src.server_comps.server.profile_manager.upload_resume", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_upload_resume_storage_error(self, mock_get_session, mock_upload_resume): 
        """Test resume upload when manager raises an error"""
        mock_get_session.return_value = self._get_session_data()
        
        # 1. Mock Manager Failure
        mock_upload_resume.side_effect = Exception("Storage error")
        
        # 2. Create a client specifically configured to catch server errors
        client = TestClient(app, raise_server_exceptions=False)
        
        # 3. Setup Cookie
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        
        pdf_content = b"%PDF-1.4 mock pdf content"
        files = {"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")}
        
        # 4. Execute
        response = client.post(
            "/api/profile/upload-resume",
            files=files
        )
        
        # 5. Assert
        assert response.status_code == 500
        
        # FIX: Do not call .json() because the default 500 response is plain text.
        # Instead, just verify the status code, or check response.text if you want.
        assert response.text == "Internal Server Error"


class TestResumeDownload:
    """Test cases for resume download/retrieval functionality"""

    @patch("src.server_comps.server.profile_manager.get_resume", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_get_resume_success(self, mock_get_session, mock_get_resume, client): # <--- Add client arg
        """Test successful resume retrieval"""
        mock_get_session.return_value = {"uid": "test_user_123", "expires": "999"}
        
        fake_url = "https://storage.googleapis.com/test-bucket/resume.pdf"
        mock_get_resume.return_value = fake_url
        
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.get("/api/profile/resume")
        
        assert response.status_code == 200
        assert response.json()["resume_url"] == fake_url
        
        mock_get_resume.assert_called_once_with("test_user_123")

    def test_get_resume_no_session(self, client): # <--- Add client arg
        """Test resume retrieval without authentication"""
        response = client.get("/api/profile/resume")
        assert response.status_code == 401

    @patch("src.server_comps.server.profile_manager.get_resume", new_callable=AsyncMock)
    @patch("src.server_comps.server.get_session", new_callable=AsyncMock)
    def test_get_resume_no_resume_uploaded(self, mock_get_session, mock_get_resume, client): # <--- Add client arg
        """Test resume retrieval when no resume exists"""
        mock_get_session.return_value = {"uid": "test_user_123", "expires": "999"}
        
        mock_get_resume.return_value = None
        
        client.cookies.set(SESSION_COOKIE_NAME, "valid_token")
        response = client.get("/api/profile/resume")
        
        assert response.status_code == 200
        data = response.json()
        assert data["resume_url"] is None
        assert data["msg"] == "No resume uploaded"