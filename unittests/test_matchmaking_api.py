import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from src.server.server import app


class TestMatchmakingQueueStatus:
    """Tests for the /api/matchmaking/queue-status endpoint"""

    def test_queue_status_empty_queue(self):
        """Test queue status when queue is empty"""
        with patch('src.server.server.redis_client') as mock_redis:
            mock_redis.llen = AsyncMock(return_value=0)
            
            client = TestClient(app)
            response = client.get("/api/matchmaking/queue-status")
            
            assert response.status_code == 200
            data = response.json()
            assert data["queue_size"] == 0
            assert data["estimated_wait_seconds"] == 5
            assert data["estimated_wait_text"] == "5s"

    def test_queue_status_one_player(self):
        """Test queue status with one player waiting"""
        with patch('src.server.server.redis_client') as mock_redis:
            mock_redis.llen = AsyncMock(return_value=1)
            
            client = TestClient(app)
            response = client.get("/api/matchmaking/queue-status")
            
            assert response.status_code == 200
            data = response.json()
            assert data["queue_size"] == 1
            assert data["estimated_wait_seconds"] == 10
            assert data["estimated_wait_text"] == "10s"

    def test_queue_status_multiple_players(self):
        """Test queue status with multiple players in queue"""
        with patch('src.server.server.redis_client') as mock_redis:
            mock_redis.llen = AsyncMock(return_value=5)
            
            client = TestClient(app)
            response = client.get("/api/matchmaking/queue-status")
            
            assert response.status_code == 200
            data = response.json()
            assert data["queue_size"] == 5
            assert data["estimated_wait_seconds"] == 3
            assert data["estimated_wait_text"] == "3s"

    def test_queue_status_redis_error(self):
        """Test queue status when Redis is unavailable - returns default values"""
        with patch('src.server.server.redis_client') as mock_redis:
            mock_redis.llen = AsyncMock(side_effect=Exception("Redis connection failed"))
            
            client = TestClient(app)
            response = client.get("/api/matchmaking/queue-status")
            
            # Should return 200 with default values when Redis fails
            assert response.status_code == 200
            data = response.json()
            assert data["queue_size"] == 0
            assert data["estimated_wait_seconds"] == 10
            assert data["estimated_wait_text"] == "10s"

    def test_queue_status_response_format(self):
        """Test that response has correct format"""
        with patch('src.server.server.redis_client') as mock_redis:
            mock_redis.llen = AsyncMock(return_value=3)
            
            client = TestClient(app)
            response = client.get("/api/matchmaking/queue-status")
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify all required fields are present
            assert "queue_size" in data
            assert "estimated_wait_seconds" in data
            assert "estimated_wait_text" in data
            
            # Verify types
            assert isinstance(data["queue_size"], int)
            assert isinstance(data["estimated_wait_seconds"], int)
            assert isinstance(data["estimated_wait_text"], str)
