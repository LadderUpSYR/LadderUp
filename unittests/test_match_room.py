"""
Unit tests for match_room.py - Match Room System for 1v1 Interview Practice

Tests cover:
- Room creation and retrieval
- Player ready status
- Room status updates
- Player access verification
- Broadcasting to rooms
- Message handling (including facial tracking)
- Audio processing
"""

import pytest
import json
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock, MagicMock
from dataclasses import asdict


class MockRedisClient:
    """Mock Redis client for testing match room operations"""
    def __init__(self):
        self.hash_store = {}
        self.sets = {}
        self.expiry = {}

    async def hset(self, key, field=None, value=None, mapping=None):
        if key not in self.hash_store:
            self.hash_store[key] = {}
        if mapping:
            self.hash_store[key].update(mapping)
        elif field and value is not None:
            self.hash_store[key][field] = value
        return 1

    async def hgetall(self, key):
        return self.hash_store.get(key, {})

    async def hget(self, key, field):
        return self.hash_store.get(key, {}).get(field)

    async def expire(self, key, seconds):
        self.expiry[key] = seconds
        return True

    async def sadd(self, key, *values):
        if key not in self.sets:
            self.sets[key] = set()
        self.sets[key].update(values)
        return len(values)

    async def srem(self, key, *values):
        if key not in self.sets:
            return 0
        removed = 0
        for value in values:
            if value in self.sets[key]:
                self.sets[key].remove(value)
                removed += 1
        return removed

    async def smembers(self, key):
        return self.sets.get(key, set())


class MockWebSocket:
    """Mock WebSocket for testing"""
    def __init__(self):
        self.sent_messages = []
        self.closed = False
        self.close_code = None

    async def send(self, message):
        self.sent_messages.append(message)

    async def close(self, code=1000):
        self.closed = True
        self.close_code = code

    def _get_current_object(self):
        return self


@pytest.fixture
def mock_redis():
    """Fixture to provide a mock Redis client"""
    return MockRedisClient()


@pytest.fixture
def mock_websocket():
    """Fixture to provide a mock WebSocket"""
    return MockWebSocket()


class TestRoomStatus:
    """Tests for the RoomStatus enum"""
    
    def test_room_status_values(self):
        """Test that RoomStatus enum has correct values"""
        from src.server_comps.match_room import RoomStatus
        
        assert RoomStatus.WAITING.value == "waiting"
        assert RoomStatus.ACTIVE.value == "active"
        assert RoomStatus.COMPLETED.value == "completed"
        assert RoomStatus.ABANDONED.value == "abandoned"


class TestMatchRoomDataclass:
    """Tests for the MatchRoom dataclass"""
    
    def test_match_room_creation(self):
        """Test creating a MatchRoom instance"""
        from src.server_comps.match_room import MatchRoom, RoomStatus
        
        room = MatchRoom(
            match_id="test-match-123",
            player1_uid="player1",
            player2_uid="player2",
            created_at="2025-12-01T00:00:00+00:00",
            status=RoomStatus.WAITING.value
        )
        
        assert room.match_id == "test-match-123"
        assert room.player1_uid == "player1"
        assert room.player2_uid == "player2"
        assert room.status == "waiting"
        assert room.player1_ready == False
        assert room.player2_ready == False
        assert room.question_id is None
        assert room.question_text is None

    def test_match_room_to_dict(self):
        """Test converting MatchRoom to dictionary"""
        from src.server_comps.match_room import MatchRoom, RoomStatus
        
        room = MatchRoom(
            match_id="test-match-123",
            player1_uid="player1",
            player2_uid="player2",
            created_at="2025-12-01T00:00:00+00:00",
            status=RoomStatus.WAITING.value
        )
        
        room_dict = asdict(room)
        
        assert room_dict["match_id"] == "test-match-123"
        assert room_dict["player1_uid"] == "player1"
        assert room_dict["player2_uid"] == "player2"
        assert room_dict["status"] == "waiting"


class TestCreateMatchRoom:
    """Tests for create_match_room function"""
    
    @pytest.mark.asyncio
    async def test_create_match_room_success(self, mock_redis):
        """Test successful room creation"""
        from src.server_comps.match_room import create_match_room, ROOM_PREFIX, ACTIVE_ROOMS_SET
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            room = await create_match_room(
                match_id="test-match-123",
                player1_uid="player1",
                player2_uid="player2"
            )
        
        assert room.match_id == "test-match-123"
        assert room.player1_uid == "player1"
        assert room.player2_uid == "player2"
        assert room.status == "waiting"
        
        # Verify room was stored in Redis
        room_key = f"{ROOM_PREFIX}test-match-123"
        assert room_key in mock_redis.hash_store
        assert mock_redis.hash_store[room_key]["match_id"] == "test-match-123"
        
        # Verify room was added to active rooms set
        assert "test-match-123" in mock_redis.sets.get(ACTIVE_ROOMS_SET, set())

    @pytest.mark.asyncio
    async def test_create_match_room_sets_expiry(self, mock_redis):
        """Test that room has TTL set"""
        from src.server_comps.match_room import create_match_room, ROOM_PREFIX, ROOM_TTL_SECONDS
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            await create_match_room(
                match_id="test-match-123",
                player1_uid="player1",
                player2_uid="player2"
            )
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        assert mock_redis.expiry.get(room_key) == ROOM_TTL_SECONDS


class TestGetMatchRoom:
    """Tests for get_match_room function"""
    
    @pytest.mark.asyncio
    async def test_get_match_room_exists(self, mock_redis):
        """Test retrieving an existing room"""
        from src.server_comps.match_room import get_match_room, ROOM_PREFIX
        
        # Pre-populate mock Redis
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {
            "match_id": "test-match-123",
            "player1_uid": "player1",
            "player2_uid": "player2",
            "status": "waiting",
            "player1_ready": "false",
            "player2_ready": "true",
            "created_at": "2025-12-01T00:00:00+00:00"
        }
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            room_data = await get_match_room("test-match-123")
        
        assert room_data is not None
        assert room_data["match_id"] == "test-match-123"
        assert room_data["player1_ready"] == False  # Converted from string
        assert room_data["player2_ready"] == True   # Converted from string

    @pytest.mark.asyncio
    async def test_get_match_room_not_exists(self, mock_redis):
        """Test retrieving a non-existent room"""
        from src.server_comps.match_room import get_match_room
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            room_data = await get_match_room("nonexistent-room")
        
        assert room_data is None

    @pytest.mark.asyncio
    async def test_get_match_room_converts_time_remaining(self, mock_redis):
        """Test that time_remaining is converted to int"""
        from src.server_comps.match_room import get_match_room, ROOM_PREFIX
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {
            "match_id": "test-match-123",
            "player1_uid": "player1",
            "player2_uid": "player2",
            "status": "active",
            "time_remaining": "300",
            "created_at": "2025-12-01T00:00:00+00:00"
        }
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            room_data = await get_match_room("test-match-123")
        
        assert room_data["time_remaining"] == 300
        assert isinstance(room_data["time_remaining"], int)


class TestVerifyPlayerAccess:
    """Tests for verify_player_access function"""
    
    @pytest.mark.asyncio
    async def test_verify_player_access_player1(self, mock_redis):
        """Test that player1 has access"""
        from src.server_comps.match_room import verify_player_access, ROOM_PREFIX
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {
            "match_id": "test-match-123",
            "player1_uid": "player1",
            "player2_uid": "player2",
            "status": "waiting",
            "created_at": "2025-12-01T00:00:00+00:00"
        }
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            has_access = await verify_player_access("test-match-123", "player1")
        
        assert has_access == True

    @pytest.mark.asyncio
    async def test_verify_player_access_player2(self, mock_redis):
        """Test that player2 has access"""
        from src.server_comps.match_room import verify_player_access, ROOM_PREFIX
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {
            "match_id": "test-match-123",
            "player1_uid": "player1",
            "player2_uid": "player2",
            "status": "waiting",
            "created_at": "2025-12-01T00:00:00+00:00"
        }
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            has_access = await verify_player_access("test-match-123", "player2")
        
        assert has_access == True

    @pytest.mark.asyncio
    async def test_verify_player_access_unauthorized(self, mock_redis):
        """Test that unauthorized player doesn't have access"""
        from src.server_comps.match_room import verify_player_access, ROOM_PREFIX
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {
            "match_id": "test-match-123",
            "player1_uid": "player1",
            "player2_uid": "player2",
            "status": "waiting",
            "created_at": "2025-12-01T00:00:00+00:00"
        }
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            has_access = await verify_player_access("test-match-123", "unauthorized_player")
        
        assert has_access == False

    @pytest.mark.asyncio
    async def test_verify_player_access_room_not_exists(self, mock_redis):
        """Test access verification for non-existent room"""
        from src.server_comps.match_room import verify_player_access
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            has_access = await verify_player_access("nonexistent-room", "player1")
        
        assert has_access == False


class TestUpdateRoomStatus:
    """Tests for update_room_status function"""
    
    @pytest.mark.asyncio
    async def test_update_room_status_to_active(self, mock_redis):
        """Test updating room status to ACTIVE"""
        from src.server_comps.match_room import update_room_status, RoomStatus, ROOM_PREFIX
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {"status": "waiting"}
        
        with patch('src.server_comps.match_room.redis_client', mock_redis), \
             patch('src.server_comps.match_room.cancel_match_timer', new_callable=AsyncMock):
            await update_room_status("test-match-123", RoomStatus.ACTIVE)
        
        assert mock_redis.hash_store[room_key]["status"] == "active"
        assert "started_at" in mock_redis.hash_store[room_key]

    @pytest.mark.asyncio
    async def test_update_room_status_to_completed(self, mock_redis):
        """Test updating room status to COMPLETED"""
        from src.server_comps.match_room import update_room_status, RoomStatus, ROOM_PREFIX, ACTIVE_ROOMS_SET
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {"status": "active"}
        mock_redis.sets[ACTIVE_ROOMS_SET] = {"test-match-123"}
        
        with patch('src.server_comps.match_room.redis_client', mock_redis), \
             patch('src.server_comps.match_room.cancel_match_timer', new_callable=AsyncMock):
            await update_room_status("test-match-123", RoomStatus.COMPLETED)
        
        assert mock_redis.hash_store[room_key]["status"] == "completed"
        assert "completed_at" in mock_redis.hash_store[room_key]
        # Room should be removed from active rooms
        assert "test-match-123" not in mock_redis.sets.get(ACTIVE_ROOMS_SET, set())


class TestSetPlayerReady:
    """Tests for set_player_ready function"""
    
    @pytest.mark.asyncio
    async def test_set_player1_ready(self, mock_redis):
        """Test marking player1 as ready"""
        from src.server_comps.match_room import set_player_ready, ROOM_PREFIX
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {
            "match_id": "test-match-123",
            "player1_uid": "player1",
            "player2_uid": "player2",
            "status": "waiting",
            "player1_ready": "false",
            "player2_ready": "false",
            "created_at": "2025-12-01T00:00:00+00:00"
        }
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            result = await set_player_ready("test-match-123", "player1")
        
        assert result["both_ready"] == False
        assert result["question"] is None
        # hset stores whatever value is passed - the code passes True (bool)
        assert mock_redis.hash_store[room_key]["player1_ready"] == True

    @pytest.mark.asyncio
    async def test_set_player2_ready(self, mock_redis):
        """Test marking player2 as ready"""
        from src.server_comps.match_room import set_player_ready, ROOM_PREFIX
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {
            "match_id": "test-match-123",
            "player1_uid": "player1",
            "player2_uid": "player2",
            "status": "waiting",
            "player1_ready": "false",
            "player2_ready": "false",
            "created_at": "2025-12-01T00:00:00+00:00"
        }
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            result = await set_player_ready("test-match-123", "player2")
        
        assert result["both_ready"] == False
        # hset stores whatever value is passed - the code passes True (bool)
        assert mock_redis.hash_store[room_key]["player2_ready"] == True

    @pytest.mark.asyncio
    async def test_both_players_ready_starts_match(self, mock_redis):
        """Test that match starts when both players are ready"""
        from src.server_comps.match_room import set_player_ready, ROOM_PREFIX
        
        room_key = f"{ROOM_PREFIX}test-match-123"
        mock_redis.hash_store[room_key] = {
            "match_id": "test-match-123",
            "player1_uid": "player1",
            "player2_uid": "player2",
            "status": "waiting",
            "player1_ready": "true",  # Player 1 already ready
            "player2_ready": "false",
            "created_at": "2025-12-01T00:00:00+00:00"
        }
        
        mock_question = {
            "id": "q1",
            "question": "Test question?",
            "answerCriteria": "Test criteria"
        }
        
        with patch('src.server_comps.match_room.redis_client', mock_redis), \
             patch('src.server_comps.match_room.get_random_question_from_firestore', 
                   new_callable=AsyncMock, return_value=mock_question), \
             patch('src.server_comps.match_room.update_room_status', new_callable=AsyncMock), \
             patch('asyncio.create_task', return_value=MagicMock()):
            result = await set_player_ready("test-match-123", "player2")
        
        assert result["both_ready"] == True
        assert result["question"] == mock_question

    @pytest.mark.asyncio
    async def test_set_player_ready_room_not_exists(self, mock_redis):
        """Test setting ready on non-existent room"""
        from src.server_comps.match_room import set_player_ready
        
        with patch('src.server_comps.match_room.redis_client', mock_redis):
            result = await set_player_ready("nonexistent-room", "player1")
        
        assert result["both_ready"] == False
        assert result["question"] is None


class TestBroadcastToRoom:
    """Tests for broadcast_to_room function"""
    
    @pytest.mark.asyncio
    async def test_broadcast_to_all_players(self):
        """Test broadcasting message to all players in room"""
        from src.server_comps.match_room import broadcast_to_room, active_connections
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        # Setup active connections
        active_connections["test-match-123"] = {
            "player1": ws1,
            "player2": ws2
        }
        
        try:
            message = {"type": "test", "data": "hello"}
            await broadcast_to_room("test-match-123", message)
            
            assert len(ws1.sent_messages) == 1
            assert len(ws2.sent_messages) == 1
            assert json.loads(ws1.sent_messages[0]) == message
            assert json.loads(ws2.sent_messages[0]) == message
        finally:
            # Cleanup
            del active_connections["test-match-123"]

    @pytest.mark.asyncio
    async def test_broadcast_excludes_player(self):
        """Test broadcasting message while excluding a player"""
        from src.server_comps.match_room import broadcast_to_room, active_connections
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        active_connections["test-match-123"] = {
            "player1": ws1,
            "player2": ws2
        }
        
        try:
            message = {"type": "test", "data": "hello"}
            await broadcast_to_room("test-match-123", message, exclude_player="player1")
            
            assert len(ws1.sent_messages) == 0  # Excluded
            assert len(ws2.sent_messages) == 1
        finally:
            del active_connections["test-match-123"]

    @pytest.mark.asyncio
    async def test_broadcast_to_nonexistent_room(self):
        """Test broadcasting to a room that doesn't exist"""
        from src.server_comps.match_room import broadcast_to_room
        
        # Should not raise an error
        await broadcast_to_room("nonexistent-room", {"type": "test"})


class TestHandleRoomMessage:
    """Tests for handle_room_message function"""
    
    @pytest.mark.asyncio
    async def test_handle_chat_message(self):
        """Test handling a chat message"""
        from src.server_comps.match_room import handle_room_message, active_connections
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        active_connections["test-match-123"] = {
            "player1": ws1,
            "player2": ws2
        }
        
        try:
            data = {"type": "chat", "message": "Hello!"}
            await handle_room_message("test-match-123", "player1", data)
            
            # Message should be broadcast to both players
            assert len(ws1.sent_messages) == 1
            assert len(ws2.sent_messages) == 1
            
            broadcast_msg = json.loads(ws1.sent_messages[0])
            assert broadcast_msg["type"] == "chat"
            assert broadcast_msg["player"] == "player1"
            assert broadcast_msg["message"] == "Hello!"
        finally:
            del active_connections["test-match-123"]

    @pytest.mark.asyncio
    async def test_handle_start_audio_message(self):
        """Test handling start_audio message"""
        from src.server_comps.match_room import handle_room_message, active_connections
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        active_connections["test-match-123"] = {
            "player1": ws1,
            "player2": ws2
        }
        
        try:
            data = {"type": "start_audio"}
            await handle_room_message("test-match-123", "player1", data)
            
            # Should only be sent to opponent (excluding sender)
            assert len(ws1.sent_messages) == 0
            assert len(ws2.sent_messages) == 1
            
            broadcast_msg = json.loads(ws2.sent_messages[0])
            assert broadcast_msg["type"] == "player_speaking"
            assert broadcast_msg["player"] == "player1"
            assert broadcast_msg["speaking"] == True
        finally:
            del active_connections["test-match-123"]

    @pytest.mark.asyncio
    async def test_handle_stop_audio_message(self):
        """Test handling stop_audio message"""
        from src.server_comps.match_room import handle_room_message, active_connections
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        active_connections["test-match-123"] = {
            "player1": ws1,
            "player2": ws2
        }
        
        try:
            data = {"type": "stop_audio"}
            await handle_room_message("test-match-123", "player1", data)
            
            assert len(ws1.sent_messages) == 0
            assert len(ws2.sent_messages) == 1
            
            broadcast_msg = json.loads(ws2.sent_messages[0])
            assert broadcast_msg["type"] == "player_speaking"
            assert broadcast_msg["speaking"] == False
        finally:
            del active_connections["test-match-123"]

    @pytest.mark.asyncio
    async def test_handle_facial_tracking_message(self):
        """Test handling facial_tracking message"""
        from src.server_comps.match_room import handle_room_message, active_connections
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        active_connections["test-match-123"] = {
            "player1": ws1,
            "player2": ws2
        }
        
        try:
            data = {
                "type": "facial_tracking",
                "attention": {
                    "isLookingAtCamera": True,
                    "attentionScore": 85,
                    "gazeDirection": "Center"
                },
                "emotion": {
                    "emotion": "Neutral",
                    "confidence": 90
                },
                "timestamp": 1234567890
            }
            await handle_room_message("test-match-123", "player1", data)
            
            # Should only be sent to opponent
            assert len(ws1.sent_messages) == 0
            assert len(ws2.sent_messages) == 1
            
            broadcast_msg = json.loads(ws2.sent_messages[0])
            assert broadcast_msg["type"] == "facial_tracking"
            assert broadcast_msg["player"] == "player1"
            assert broadcast_msg["attention"]["attentionScore"] == 85
            assert broadcast_msg["attention"]["isLookingAtCamera"] == True
        finally:
            del active_connections["test-match-123"]

    @pytest.mark.asyncio
    async def test_handle_signal_message(self):
        """Test handling WebRTC signal message"""
        from src.server_comps.match_room import handle_room_message, active_connections
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        active_connections["test-match-123"] = {
            "player1": ws1,
            "player2": ws2
        }
        
        try:
            data = {
                "type": "signal",
                "signal": {"sdp": "test-sdp", "type": "offer"}
            }
            await handle_room_message("test-match-123", "player1", data)
            
            # Signal should only go to opponent
            assert len(ws1.sent_messages) == 0
            assert len(ws2.sent_messages) == 1
            
            broadcast_msg = json.loads(ws2.sent_messages[0])
            assert broadcast_msg["type"] == "signal"
            assert broadcast_msg["from"] == "player1"
            assert broadcast_msg["signal"]["type"] == "offer"
        finally:
            del active_connections["test-match-123"]

    @pytest.mark.asyncio
    async def test_handle_unknown_message_type(self):
        """Test handling unknown message type doesn't crash"""
        from src.server_comps.match_room import handle_room_message
        
        # Should not raise an error
        await handle_room_message("test-match-123", "player1", {"type": "unknown_type"})


class TestGetRandomQuestionFromFirestore:
    """Tests for get_random_question_from_firestore function"""
    
    @pytest.mark.asyncio
    async def test_returns_default_question_on_empty_collection(self):
        """Test that default question is returned when collection is empty"""
        from src.server_comps.match_room import get_random_question_from_firestore
        
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_collection.stream.return_value = []
        mock_db.collection.return_value = mock_collection
        
        # Patch the db in the server module since it's imported from there
        with patch('src.server_comps.server.db', mock_db):
            question = await get_random_question_from_firestore()
        
        assert question["id"] == 1
        assert "question" in question
        assert "answerCriteria" in question

    @pytest.mark.asyncio
    async def test_returns_random_question_from_firestore(self):
        """Test fetching a random question from Firestore"""
        from src.server_comps.match_room import get_random_question_from_firestore
        
        mock_doc = MagicMock()
        mock_doc.id = "question-123"
        mock_doc.to_dict.return_value = {
            "question": "What is your greatest strength?",
            "answerCriteria": "Use specific examples"
        }
        
        mock_db = MagicMock()
        mock_collection = MagicMock()
        mock_collection.stream.return_value = [mock_doc]
        mock_db.collection.return_value = mock_collection
        
        with patch('src.server_comps.server.db', mock_db):
            question = await get_random_question_from_firestore()
        
        assert question["id"] == "question-123"
        assert question["question"] == "What is your greatest strength?"
        assert question["answerCriteria"] == "Use specific examples"

    @pytest.mark.asyncio
    async def test_returns_default_question_on_error(self):
        """Test that default question is returned on Firestore error"""
        from src.server_comps.match_room import get_random_question_from_firestore
        
        mock_db = MagicMock()
        mock_db.collection.side_effect = Exception("Firestore error")
        
        with patch('src.server_comps.server.db', mock_db):
            question = await get_random_question_from_firestore()
        
        assert question["id"] == 1
        assert "question" in question


class TestConstants:
    """Tests for module constants"""
    
    def test_constants_values(self):
        """Test that constants have expected values"""
        from src.server_comps.match_room import (
            ROOM_PREFIX, ROOM_TTL_SECONDS, ACTIVE_ROOMS_SET,
            MATCH_DURATION_SECONDS, AUDIO_RATE, CHUNK_DURATION
        )
        
        assert ROOM_PREFIX == "room:"
        assert ROOM_TTL_SECONDS == 3600  # 1 hour
        assert ACTIVE_ROOMS_SET == "active_rooms"
        assert MATCH_DURATION_SECONDS == 420  # 7 minutes
        assert AUDIO_RATE == 16000  # 16kHz
        assert CHUNK_DURATION == 3  # 3 seconds


class TestAudioBuffers:
    """Tests for audio buffer management"""
    
    def test_audio_buffers_initialization(self):
        """Test that audio_buffers dict exists"""
        from src.server_comps.match_room import audio_buffers
        
        assert isinstance(audio_buffers, dict)

    @pytest.mark.asyncio
    async def test_process_audio_chunk_creates_buffer(self):
        """Test that process_audio_chunk creates buffer for new player"""
        from src.server_comps.match_room import process_audio_chunk, audio_buffers, AUDIO_RATE
        
        # Create a small audio chunk (less than CHUNK_DURATION)
        # 1 second of audio at 16kHz = 16000 samples * 2 bytes = 32000 bytes
        small_chunk = bytes(16000)  # 0.5 seconds
        
        buffer_key = "test-match:test-player"
        
        # Clean up any existing buffer
        if buffer_key in audio_buffers:
            del audio_buffers[buffer_key]
        
        try:
            await process_audio_chunk("test-match", "test-player", small_chunk)
            
            assert buffer_key in audio_buffers
            assert len(audio_buffers[buffer_key]) == 1
        finally:
            # Cleanup
            if buffer_key in audio_buffers:
                del audio_buffers[buffer_key]
