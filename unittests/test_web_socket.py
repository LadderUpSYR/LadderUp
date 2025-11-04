import os, sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
import pytest
import json
import asyncio

# Ensure src is in sys.path
SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

class MockRedisClient:
    def __init__(self):
        self.data = {}
        self.lists = {}
        self.pubsub_messages = []
        self.store = {}
        self.hash_store = {}
        self.expiry = {}
        self.sets = {}  # Add this for set operations
        
    async def rpush(self, key, value):
        if key not in self.lists:
            self.lists[key] = []
        self.lists[key].append(value)
        return len(self.lists[key])
    
    async def llen(self, key):
        return len(self.lists.get(key, []))
    
    async def lpop(self, key):
        if key in self.lists and self.lists[key]:
            return self.lists[key].pop(0).encode()
        return None
    
    async def lrem(self, key, count, value):
        """Mock Redis lrem for removing items from a list"""
        if key not in self.lists:
            return 0
        removed = 0
        if count == 0:  # Remove all occurrences
            original_len = len(self.lists[key])
            self.lists[key] = [item for item in self.lists[key] if item != value]
            removed = original_len - len(self.lists[key])
        elif count > 0:  # Remove first N occurrences
            for _ in range(count):
                try:
                    self.lists[key].remove(value)
                    removed += 1
                except ValueError:
                    break
        else:  # count < 0, remove last N occurrences
            count = abs(count)
            for _ in range(count):
                try:
                    # Find and remove from the end
                    for i in range(len(self.lists[key]) - 1, -1, -1):
                        if self.lists[key][i] == value:
                            self.lists[key].pop(i)
                            removed += 1
                            break
                except (ValueError, IndexError):
                    break
        return removed
    
    async def publish(self, channel, message):
        self.pubsub_messages.append((channel, message))
        return 1

    async def hgetall(self, key):
        return self.hash_store.get(key, {})
    
    async def hset(self, key, field=None, value=None, mapping=None):
        """Mock Redis hset for storing hash fields"""
        if key not in self.hash_store:
            self.hash_store[key] = {}
        
        if mapping:
            self.hash_store[key].update(mapping)
            return len(mapping)
        elif field is not None:
            self.hash_store[key][field] = value
            return 1
        return 0
    
    async def hget(self, key, field):
        """Mock Redis hget for retrieving hash fields"""
        return self.hash_store.get(key, {}).get(field)
    
    async def expire(self, key, seconds):
        """Mock Redis expire for setting key expiration"""
        self.expiry[key] = seconds
        return 1
    
    async def sadd(self, key, *values):
        """Mock Redis sadd for adding to sets"""
        if key not in self.sets:
            self.sets[key] = set()
        self.sets[key].update(values)
        return len(values)
    
    async def srem(self, key, *values):
        """Mock Redis srem for removing from sets"""
        if key not in self.sets:
            return 0
        removed = 0
        for value in values:
            if value in self.sets[key]:
                self.sets[key].remove(value)
                removed += 1
        return removed
    
    async def smembers(self, key):
        """Mock Redis smembers for getting all set members"""
        return self.sets.get(key, set())
    
    async def time(self):
        return [1234567890, 0]
    
    def pubsub(self):
        return MockPubSub(self.pubsub_messages)

class MockPubSub:
    def __init__(self, messages):
        self.messages = messages
        self.subscribed = False
        
    async def subscribe(self, channel):
        self.subscribed = True
        
    async def listen(self):
        # Yield subscription confirmation
        yield {"type": "subscribe"}
        # Yield actual messages
        for channel, data in self.messages:
            yield {"type": "message", "data": data}

@pytest.fixture
def mock_redis():
    return MockRedisClient()

@pytest.fixture
def load_ws_app():
    """Load the WebSocket app with necessary patches"""
    env = {
        "GOOGLE_CLIENT_ID": "test-client-id",
        "FIREBASE_SERVICE_ACCOUNT_KEY": "{}"
    }
    
    mock_redis_client = MockRedisClient()
    
    # Create a mock Firebase app
    mock_firebase_app = MagicMock()
    
    with patch.dict(os.environ, env, clear=False), \
         patch("firebase_admin.initialize_app", return_value=mock_firebase_app), \
         patch("firebase_admin.credentials.Certificate", lambda *a, **k: object()), \
         patch("firebase_admin.firestore.client", lambda: object()), \
         patch("firebase_admin.storage.bucket", return_value=MagicMock()), \
         patch("asyncio.create_task", return_value=MagicMock()):
        
        # Import after patching
        from src.server_comps.websocketserver import app, SESSION_COOKIE_NAME

    
    return app, SESSION_COOKIE_NAME, mock_redis_client

class MockWebSocket:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}
        self.sent_messages = []
        self.closed = False
        self.close_code = None
        self.accepted = False
        
    async def send(self, message):
        self.sent_messages.append(message)

    async def accept(self):
        self.accepted = True
        
    async def close(self, code=1000):
        self.closed = True
        self.close_code = code

# ------------------ Tests ------------------
@pytest.mark.asyncio
async def test_ws_missing_session_token(load_ws_app):
    """Test WebSocket rejects connection without session token"""
    app, SESSION_COOKIE_NAME, _ = load_ws_app
    
    mock_ws = MockWebSocket(cookies={})
    
    with patch("src.server_comps.websocketserver.websocket", mock_ws):
        from src.server_comps.websocketserver import join_websocket
        await join_websocket()
    
    # Should send error and close
    assert len(mock_ws.sent_messages) == 1
    error_msg = json.loads(mock_ws.sent_messages[0])
    assert error_msg["error"] == "Missing session token"
    assert mock_ws.closed is True
    assert mock_ws.close_code == 1008

@pytest.mark.asyncio
async def test_ws_invalid_session_token(load_ws_app):
    """Test WebSocket rejects connection with invalid session"""
    app, SESSION_COOKIE_NAME, _ = load_ws_app
    
    mock_ws = MockWebSocket(cookies={SESSION_COOKIE_NAME: "invalid_token"})
    
    with patch("src.server_comps.websocketserver.websocket", mock_ws), \
         patch("src.server_comps.server.get_session", AsyncMock(return_value=None)):
        
        from src.server_comps.websocketserver import join_websocket
        await join_websocket()
    
    # Should send error and close
    assert len(mock_ws.sent_messages) == 1
    error_msg = json.loads(mock_ws.sent_messages[0])
    assert error_msg["error"] == "Invalid or expired session"
    assert mock_ws.closed is True
    assert mock_ws.close_code == 1008

@pytest.mark.asyncio
async def test_ws_enqueues_player_successfully(load_ws_app):
    """Test player is enqueued when connecting with valid session"""
    app, SESSION_COOKIE_NAME, mock_redis = load_ws_app
    
    user_id = "user123"
    session_data = {"uid": user_id, "name": "Test User", "email": "test@example.com"}
    mock_ws = MockWebSocket(cookies={SESSION_COOKIE_NAME: "valid_token"})
    
    # Track queue length at specific point
    queue_snapshot = {"length": 0}
    
    async def mock_listen():
        # Snapshot queue length when listen_for_match is called
        # (this happens after enqueue_player)
        queue_snapshot["length"] = await mock_redis.llen("match_queue")
        
        # Block forever
        await asyncio.Event().wait()
        if False:
            yield
    
    with patch("src.server_comps.websocketserver.websocket", mock_ws), \
         patch("src.server_comps.websocketserver.get_session", AsyncMock(return_value=session_data)), \
         patch("src.server_comps.websocketserver.listen_for_match", mock_listen), \
         patch("server_comps.matchmaking.redis_client", mock_redis):
        
        from src.server_comps.websocketserver import join_websocket
        
        # Run with timeout since it will block forever
        try:
            await asyncio.wait_for(join_websocket(), timeout=0.1)
        except asyncio.TimeoutError:
            pass  # Expected
    
    # Should send queued confirmation
    assert len(mock_ws.sent_messages) >= 1
    queued_msg = json.loads(mock_ws.sent_messages[0])
    assert queued_msg["status"] == "queued"
    assert queued_msg["user"] == user_id
    
    # Queue was populated before listen_for_match started
    assert queue_snapshot["length"] == 1

@pytest.mark.asyncio
async def test_ws_match_found_partner_ordering(load_ws_app):
    app, SESSION_COOKIE_NAME, mock_redis = load_ws_app
    user_id = "user789"
    partner_id = "user321"
    session_data = {"uid": user_id, "name": "Test User", "email": "test@example.com"}
    mock_ws = MockWebSocket(cookies={SESSION_COOKIE_NAME: "valid_token"})

    # Mock the MatchRoom object to be returned
    mock_room = MagicMock()
    mock_room.match_id = "mock_match_id"

    # Use event for better coordination
    match_ready = asyncio.Event()

    async def mock_listen_for_match():
        # Wait for match to be published
        await match_ready.wait()
        
        # Yield the match data
        channel, match_msg = mock_redis.pubsub_messages[0]
        yield json.loads(match_msg)

    # Patch BOTH module paths since they're different instances
    with patch("src.server_comps.websocketserver.websocket", mock_ws), \
         patch("src.server_comps.websocketserver.get_session", AsyncMock(return_value=session_data)), \
         patch("src.server_comps.websocketserver.listen_for_match", mock_listen_for_match), \
         patch("src.server_comps.matchmaking.redis_client", mock_redis), \
         patch("server_comps.matchmaking.redis_client", mock_redis), \
         patch("src.server_comps.match_room.redis_client", mock_redis), \
         patch("server_comps.match_room.redis_client", mock_redis), \
         patch("src.server_comps.matchmaking.create_match_room", AsyncMock(return_value=mock_room)), \
         patch("server_comps.matchmaking.create_match_room", AsyncMock(return_value=mock_room)):

        # Import INSIDE the patch context
        from src.server_comps.matchmaking import enqueue_player, try_match_players
        from src.server_comps.websocketserver import join_websocket

        await enqueue_player(partner_id)

        # Start join_websocket
        join_task = asyncio.create_task(join_websocket())
        await asyncio.sleep(0.05)  # Give it time to start

        # Run matchmaking
        await try_match_players()
        match_ready.set()  # Signal that match is ready
        
        # Give time for message processing
        await asyncio.sleep(0.05)
        
        # Complete the task with timeout to prevent hanging
        try:
            await asyncio.wait_for(join_task, timeout=1.0)
        except asyncio.TimeoutError:
            join_task.cancel()
            pytest.fail("join_websocket timed out")

    # Should have both messages
    assert len(mock_ws.sent_messages) == 2, f"Expected 2 messages, got {len(mock_ws.sent_messages)}: {mock_ws.sent_messages}"
    
    queued_msg = json.loads(mock_ws.sent_messages[0])
    assert queued_msg["status"] == "queued"
    
    match_msg = json.loads(mock_ws.sent_messages[1])
    assert match_msg["status"] == "match_found"
    assert match_msg["partner"] == partner_id



# ------------------ Matchmaking Logic Tests ------------------
@pytest.mark.asyncio
async def test_enqueue_player():
    """Test player is added to queue"""
    mock_redis = MockRedisClient()
    
    with patch("src.server_comps.matchmaking.redis_client", mock_redis):
        from src.server_comps.matchmaking import enqueue_player
        await enqueue_player("user123")
    
    assert await mock_redis.llen("match_queue") == 1

@pytest.mark.asyncio
async def test_try_match_players_insufficient_queue():
    """Test no match created when queue has fewer than 2 players"""
    mock_redis = MockRedisClient()
    await mock_redis.rpush("match_queue", "user1")
    
    with patch("src.server_comps.matchmaking.redis_client", mock_redis):
        from src.server_comps.matchmaking import enqueue_player, try_match_players
        await try_match_players()
    
    # Queue should still have 1 player
    assert await mock_redis.llen("match_queue") == 1
    # No match published
    assert len(mock_redis.pubsub_messages) == 0

@pytest.mark.asyncio
async def test_try_match_players_creates_match():
    """Test match is created when 2+ players in queue"""
    mock_redis = MockRedisClient()
    await mock_redis.rpush("match_queue", "user1")
    await mock_redis.rpush("match_queue", "user2")
    
    # Mock the MatchRoom object to be returned
    mock_room = MagicMock()
    mock_room.match_id = "mock_match_id"

    with patch("src.server_comps.matchmaking.redis_client", mock_redis), \
         patch("src.server_comps.matchmaking.create_match_room", AsyncMock(return_value=mock_room)): # <-- **ADD THIS LINE**
        
        from src.server_comps.matchmaking import enqueue_player, try_match_players
        await try_match_players()

    # Queue should be empty
    assert await mock_redis.llen("match_queue") == 0
    # ... (rest of the test)
    # Match should be published
    assert len(mock_redis.pubsub_messages) == 1
    
    channel, message_data = mock_redis.pubsub_messages[0]
    assert channel == "match_channel"
    
    match_info = json.loads(message_data)
    assert "user1" in match_info["players"]
    assert "user2" in match_info["players"]
    assert "match_id" in match_info
    assert match_info["match_id"].startswith("match_")

@pytest.mark.asyncio
async def test_try_match_players_with_three_in_queue():
    """Test only first 2 players are matched, third remains in queue"""
    mock_redis = MockRedisClient()
    await mock_redis.rpush("match_queue", "user1")
    await mock_redis.rpush("match_queue", "user2")
    await mock_redis.rpush("match_queue", "user3")

    # Mock the MatchRoom object to be returned
    mock_room = MagicMock()
    mock_room.match_id = "mock_match_id"

    with patch("src.server_comps.matchmaking.redis_client", mock_redis), \
         patch("src.server_comps.matchmaking.create_match_room", AsyncMock(return_value=mock_room)): # <-- **ADD THIS LINE**
        
        from src.server_comps.matchmaking import enqueue_player, try_match_players
        await try_match_players()

    # Queue should have 1 player left
    assert await mock_redis.llen("match_queue") == 1
    # ... (rest of the test)
    # One match published
    assert len(mock_redis.pubsub_messages) == 1

@pytest.mark.asyncio
async def test_listen_for_match():
    """Test listen_for_match yields published matches"""
    mock_redis = MockRedisClient()
    
    # Simulate a published match
    match_data = {
        "players": ["user1", "user2"],
        "match_id": "match_test_123"
    }
    mock_redis.pubsub_messages.append(("match_channel", json.dumps(match_data)))
    
    with patch("src.server_comps.matchmaking.redis_client", mock_redis):
        from src.server_comps.matchmaking import enqueue_player, try_match_players, listen_for_match
        
        matches_received = []
        async for match in listen_for_match():
            matches_received.append(match)
            break  # Only get first match
    
    assert len(matches_received) == 1
    assert matches_received[0]["players"] == ["user1", "user2"]
    assert matches_received[0]["match_id"] == "match_test_123"

# ------------------ Background Task Tests ------------------
@pytest.mark.asyncio
async def test_matchmaking_background_task_runs():
    """Test background task continuously tries to match players"""
    mock_redis = MockRedisClient()
    call_count = 0
    
    async def mock_try_match():
        nonlocal call_count
        call_count += 1
        if call_count >= 3:
            raise asyncio.CancelledError()
    
    with patch("src.server_comps.websocketserver.try_match_players", mock_try_match), \
         patch("asyncio.sleep", AsyncMock()):
        
        from src.server_comps.websocketserver import matchmaking_background_task
        
        try:
            await matchmaking_background_task()
        except asyncio.CancelledError:
            pass
    
    # Should have called try_match_players multiple times
    assert call_count == 3