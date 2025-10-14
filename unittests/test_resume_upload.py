import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
import sys
import os
from io import BytesIO

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
                
                from src.server.server import app, db, bucket

client = TestClient(app)


@pytest.fixture
def mock_session():
    """Fixture to mock a valid user session"""
    with patch('src.server.server.get_session') as mock_get:
        mock_get.return_value = {
            "uid": "test_user_123",
            "name": "Test User",
            "email": "test@example.com",
            "expires": "9999999999"
        }
        yield mock_get


@pytest.fixture
def mock_storage_bucket():
    """Fixture to mock Firebase Storage bucket"""
    with patch('src.server.server.bucket') as mock_bucket:
        mock_blob = MagicMock()
        mock_blob.public_url = "https://storage.googleapis.com/test-bucket/resumes/test_user_123/resume.pdf"
        mock_bucket.blob.return_value = mock_blob
        yield mock_bucket


@pytest.fixture
def mock_firestore_db():
    """Fixture to mock Firestore database"""
    with patch('src.server.server.db') as mock_db:
        mock_doc_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref
        yield mock_db


class TestResumeUpload:
    """Test cases for resume upload functionality"""

    def test_upload_resume_success(self, mock_session, mock_storage_bucket, mock_firestore_db):
        """Test successful resume upload"""
        # Create a mock PDF file
        pdf_content = b"%PDF-1.4 mock pdf content"
        files = {"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")}
        
        # Set session cookie on client instance
        client.cookies.set("session_token", "valid_token")
        
        # Make the request
        response = client.post(
            "/api/profile/upload-resume",
            files=files
        )
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "Resume uploaded successfully"
        assert "resume_url" in data
        assert data["resume_url"].startswith("https://storage.googleapis.com")
        
        # Verify storage operations were called
        mock_storage_bucket.blob.assert_called_once_with("resumes/test_user_123/resume.pdf")
        
        # Verify Firestore update was called
        mock_firestore_db.collection.assert_called_with("users")
        
        # Clear cookies after test
        client.cookies.clear()

    def test_upload_resume_no_session(self):
        """Test resume upload without authentication"""
        pdf_content = b"%PDF-1.4 mock pdf content"
        files = {"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")}
        
        response = client.post("/api/profile/upload-resume", files=files)
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_upload_resume_invalid_file_type(self, mock_session):
        """Test resume upload with non-PDF file"""
        # Create a non-PDF file
        files = {"file": ("resume.txt", BytesIO(b"text content"), "text/plain")}
        
        # Set session cookie on client instance
        client.cookies.set("session_token", "valid_token")
        
        response = client.post(
            "/api/profile/upload-resume",
            files=files
        )
        
        assert response.status_code == 400
        assert response.json()["detail"] == "Only PDF files are allowed"
        
        # Clear cookies after test
        client.cookies.clear()

    def test_upload_resume_file_too_large(self, mock_session):
        """Test resume upload with file exceeding size limit"""
        # Create a file larger than 10MB
        large_content = b"x" * (11 * 1024 * 1024)  # 11MB
        files = {"file": ("resume.pdf", BytesIO(large_content), "application/pdf")}
        
        # Set session cookie on client instance
        client.cookies.set("session_token", "valid_token")
        
        response = client.post(
            "/api/profile/upload-resume",
            files=files
        )
        
        assert response.status_code == 400
        assert response.json()["detail"] == "File size must be less than 10MB"
        
        # Clear cookies after test
        client.cookies.clear()

    def test_upload_resume_storage_error(self, mock_session, mock_storage_bucket, mock_firestore_db):
        """Test resume upload when storage fails"""
        # Mock storage to raise an exception
        mock_blob = MagicMock()
        mock_blob.upload_from_string.side_effect = Exception("Storage error")
        mock_storage_bucket.blob.return_value = mock_blob
        
        pdf_content = b"%PDF-1.4 mock pdf content"
        files = {"file": ("resume.pdf", BytesIO(pdf_content), "application/pdf")}
        
        # Set session cookie on client instance
        client.cookies.set("session_token", "valid_token")
        
        response = client.post(
            "/api/profile/upload-resume",
            files=files
        )
        
        assert response.status_code == 500
        assert response.json()["detail"] == "Failed to upload resume"
        
        # Clear cookies after test
        client.cookies.clear()


class TestResumeDownload:
    """Test cases for resume download/retrieval functionality"""

    def test_get_resume_success(self, mock_session, mock_firestore_db):
        """Test successful resume retrieval"""
        # Mock Firestore to return a user with a resume
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "uid": "test_user_123",
            "resume_url": "https://storage.googleapis.com/test-bucket/resumes/test_user_123/resume.pdf"
        }
        mock_firestore_db.collection.return_value.document.return_value.get.return_value = mock_doc
        
        # Set session cookie on client instance
        client.cookies.set("session_token", "valid_token")
        
        response = client.get("/api/profile/resume")
        
        assert response.status_code == 200
        data = response.json()
        assert "resume_url" in data
        assert data["resume_url"].startswith("https://storage.googleapis.com")
        
        # Clear cookies after test
        client.cookies.clear()

    def test_get_resume_no_session(self):
        """Test resume retrieval without authentication"""
        response = client.get("/api/profile/resume")
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_get_resume_no_resume_uploaded(self, mock_session, mock_firestore_db):
        """Test resume retrieval when no resume exists"""
        # Mock Firestore to return a user without a resume
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "uid": "test_user_123",
            "name": "Test User"
        }
        mock_firestore_db.collection.return_value.document.return_value.get.return_value = mock_doc
        
        # Set session cookie on client instance
        client.cookies.set("session_token", "valid_token")
        
        response = client.get("/api/profile/resume")
        
        assert response.status_code == 200
        data = response.json()
        assert data["resume_url"] is None
        assert data["msg"] == "No resume uploaded"
        
        # Clear cookies after test
        client.cookies.clear()

    def test_get_resume_user_not_found(self, mock_session, mock_firestore_db):
        """Test resume retrieval when user doesn't exist"""
        # Mock Firestore to return no user
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_firestore_db.collection.return_value.document.return_value.get.return_value = mock_doc
        
        # Set session cookie on client instance
        client.cookies.set("session_token", "valid_token")
        
        response = client.get("/api/profile/resume")
        
        assert response.status_code == 404
        assert response.json()["detail"] == "User not found"
        
        # Clear cookies after test
        client.cookies.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
