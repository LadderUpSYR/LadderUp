"""
Shared pytest configuration and fixtures for all unit tests.

This module centralizes common fixtures, mock classes, and setup logic
that's used across multiple test files to avoid duplication.
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import RedisError


# ==================== PATH SETUP ====================
# Ensure src is in sys.path
SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


# ==================== MOCK CLASSES ====================
# Fake Firestore classes
class _Doc:
    """Mock Firestore document snapshot"""
    def __init__(self, exists, data=None):
        self._e, self._d = exists, data or {}

    @property
    def exists(self):
        return self._e

    def to_dict(self):
        return self._d


class _DocRef:
    """Mock Firestore document reference"""
    def __init__(self, store, uid):
        self.store, self.uid = store, uid

    def get(self):
        return _Doc(self.uid in self.store, self.store.get(self.uid))

    def set(self, data):
        self.store[self.uid] = data


class _Collection:
    """Mock Firestore collection"""
    def __init__(self, store):
        self.store = store

    def document(self, uid):
        return _DocRef(self.store, uid)

    def where(self, field, op, value):
        """Mock the where() method for querying"""
        mock_query = MagicMock()
        mock_query.limit = MagicMock(return_value=mock_query)

        # Return matching documents
        matching = []
        for uid, data in self.store.items():
            if field in data and data[field] == value:
                matching.append(_Doc(True, data))

        mock_query.stream = MagicMock(return_value=iter(matching))
        return mock_query


class _DB:
    """Mock Firestore database"""
    def __init__(self):
        self.users = {}

    def collection(self, name):
        assert name == "users"
        return _Collection(self.users)


class MockRedisClient:
    """Mock Redis client for testing"""
    def __init__(self, *args, **kwargs):
        self.data = {}
        self.session_data = {}
        self.lists = {}
        self.pubsub_messages = []
        self.hash_store = {}
        self.expiry = {}
        self.sets = {}

    # Use AsyncMock for all Redis operations
    hset = AsyncMock()
    expire = AsyncMock(return_value=True)
    delete = AsyncMock(return_value=True)

    async def hgetall(self, key):
        """Return session data if it exists"""
        return self.session_data.get(key, {})

    async def set(self, key, value, ex=None):
        self.data[key] = value
        return True

    async def get(self, key):
        return self.data.get(key)

    async def rpush(self, key, value):
        if key not in self.lists:
            self.lists[key] = []
        self.lists[key].append(value)
        return len(self.lists[key])

    async def llen(self, key):
        return len(self.lists.get(key, []))

    async def lpop(self, key):
        if key in self.lists and self.lists[key]:
            # Return string (not bytes) to match decode_responses=True behavior
            return self.lists[key].pop(0)
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

    async def hget(self, key, field):
        """Mock Redis hget for retrieving hash fields"""
        return self.hash_store.get(key, {}).get(field)

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

    @classmethod
    def Redis(cls, *args, **kwargs):
        return cls()


class MockPubSub:
    """Mock Redis PubSub"""
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


class MockWebSocket:
    """Mock WebSocket for testing"""
    def __init__(self, cookies=None, auth_token=None, auth_message=None):
        self.cookies = cookies or {}
        self.auth_token = auth_token
        self.auth_message = auth_message  # Custom first message to send
        self.sent_messages = []
        self.closed = False
        self.close_code = None
        self.accepted = False
        self._receive_called = False

    async def send(self, message):
        self.sent_messages.append(message)

    async def accept(self):
        self.accepted = True

    async def close(self, code=1000):
        self.closed = True
        self.close_code = code

    async def receive(self):
        """Mock receive - returns auth message on first call"""
        if not self._receive_called:
            self._receive_called = True
            if self.auth_message is not None:
                return self.auth_message
            elif self.auth_token is not None:
                return json.dumps({"type": "authenticate", "token": self.auth_token})
            else:
                # No auth provided - simulate timeout
                raise asyncio.TimeoutError()
        # Subsequent calls block forever
        await asyncio.Event().wait()


# ==================== FIXTURES ====================
@pytest.fixture
def load_app_with_env():
    """Load the FastAPI app with mocked Firebase and Redis for testing"""
    env = {
        "GOOGLE_CLIENT_ID": "test-client-id",
        "FIREBASE_SERVICE_ACCOUNT_KEY": "{}",
        "TESTING": "1"
    }
    os.environ.update(env)  # Set environment variables explicitly
    print(f"TESTING env var: {os.getenv('TESTING')}")

    with patch.dict(os.environ, env, clear=False), \
         patch("firebase_admin.initialize_app", lambda *a, **k: None), \
         patch("firebase_admin.credentials.Certificate", lambda *a, **k: object()), \
         patch("firebase_admin.firestore.client", lambda: object()), \
         patch("firebase_admin.storage.bucket", return_value=MagicMock()), \
         patch("redis.asyncio.Redis", MockRedisClient.Redis):

        # import after patching
        from src.server_comps import server as appmod

    # attach fake db and enable debug mode
    fakedb = _DB()
    appmod.db = fakedb
    appmod.GOOGLE_CLIENT_ID = "test-client-id"
    appmod.app.debug = True  # Enable debug mode to see full tracebacks
    client = TestClient(appmod.app)
    return appmod, client, fakedb


@pytest.fixture
def mock_redis():
    """Fixture to provide a mock Redis client"""
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
        from server_comps.websocketserver import app, SESSION_COOKIE_NAME

    return app, SESSION_COOKIE_NAME, mock_redis_client


@pytest.fixture
def mock_session():
    """Fixture to mock a valid user session"""
    with patch('src.server_comps.server.get_session') as mock_get:
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
    with patch('src.server_comps.server.bucket') as mock_bucket:
        mock_blob = MagicMock()
        mock_blob.public_url = "https://storage.googleapis.com/test-bucket/resumes/test_user_123/resume.pdf"
        mock_bucket.blob.return_value = mock_blob
        yield mock_bucket


@pytest.fixture
def mock_firestore_db():
    """Fixture to mock Firestore database"""
    with patch('src.server_comps.server.db') as mock_db:
        mock_doc_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref
        yield mock_db


@pytest.fixture
def mock_websocket():
    """Fixture to provide a mock WebSocket"""
    return MockWebSocket()
