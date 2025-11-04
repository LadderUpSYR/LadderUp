import os, sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from redis.exceptions import RedisError 
import pytest

# Ensure src is in sys.path
SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

# ------------------ Fake Firestore classes ------------------
class _Doc:
    def __init__(self, exists, data=None): 
        self._e, self._d = exists, data or {}
    @property
    def exists(self): return self._e
    def to_dict(self): return self._d

class _DocRef:
    def __init__(self, store, uid): self.store, self.uid = store, uid
    def get(self): return _Doc(self.uid in self.store, self.store.get(self.uid))
    def set(self, data): self.store[self.uid] = data

class _Collection:
    def __init__(self, store): self.store = store
    def document(self, uid): return _DocRef(self.store, uid)
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
    def __init__(self): self.users = {}
    def collection(self, name):
        assert name == "users"
        return _Collection(self.users)

from redis.exceptions import RedisError
from unittest.mock import AsyncMock # already imported

# Functions to simulate failure in store_session, forcing fallback
async def mock_hset(*args, **kwargs):
    # This simulates a connection error, forcing the store_session 'except' block.
    # This ensures the session logic correctly uses memory_sessions in the test.
    raise RedisError("Mocked Redis Failure for testing") 
    
class MockRedisClient:
    def __init__(self, *args, **kwargs):
        self.data = {}
        self.session_data = {}
    
    # Use AsyncMock for all Redis operations
    hset = AsyncMock()
    expire = AsyncMock(return_value=True)
    delete = AsyncMock(return_value=True)

    async def hgetall(self, key):
        # Return session data if it exists
        return self.session_data.get(key, {})

    async def set(self, key, value, ex=None):
        self.data[key] = value
        return True

    async def get(self, key):
        return self.data.get(key)
    
    @classmethod
    def Redis(cls, *args, **kwargs):
        return cls() 

# ------------------ Fixture ------------------
@pytest.fixture
def load_app_with_env():
    env = {
        "GOOGLE_CLIENT_ID": "test-client-id",
        "FIREBASE_SERVICE_ACCOUNT_KEY": "{}",
        "TESTING": "1"
    }


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

# ------------------ Tests ------------------
def test_health_ok(load_app_with_env):
    appmod, client, _ = load_app_with_env
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}

def test_missing_token_400(load_app_with_env):
    appmod, client, _ = load_app_with_env
    r = client.post("/api/auth/login", json={"recaptchaToken": "test-token"})
    assert r.status_code == 400
    assert r.json()["detail"] == "Missing token"

def test_invalid_token_401(load_app_with_env):
    appmod, client, _ = load_app_with_env
    with patch.object(appmod.id_token, "verify_oauth2_token", side_effect=Exception("bad")):
        r = client.post("/api/auth/login", json={"token": "BAD", "recaptchaToken": "test-token"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"

# ------------------ Parameterized login test ------------------
@pytest.mark.parametrize(
    "fake_uid,fake_profile,token_email,token_name,expected_msg",
    [
        ("12345", None, "cookie@test.com", "CookieUser", "New user created"),
        ("67890", {"name": "StoredUser", "email": "stored@test.com", "questions": []}, 
         "stored@test.com", "StoredUser", "User Exists")
    ]
)
def test_login_user_sets_cookie(load_app_with_env, fake_uid, fake_profile, token_email, token_name, expected_msg):
    appmod, client, _ = load_app_with_env

    with patch("src.server_comps.server.id_token.verify_oauth2_token") as mock_verify, \
         patch("src.server_comps.server.db") as mock_db, \
         patch("src.server_comps.server.redis_client") as mock_redis:

        mock_verify.return_value = {
            "sub": fake_uid,
            "email": token_email,
            "name": token_name
        }

        # Mock Firestore document
        fake_doc = MagicMock()
        if fake_profile:
            fake_doc.exists = True
            fake_doc.to_dict.return_value = fake_profile
        else:
            fake_doc.exists = False

        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc

        # Set up all required Redis mocks
        mock_redis.hset = AsyncMock(return_value=True)
        mock_redis.expire = AsyncMock(return_value=True)
        mock_redis.hgetall = AsyncMock(return_value={})

        # Make request inside the patch block so mocks are active
        response = client.post("/api/auth/login", json={"token": "FAKE_TOKEN", "recaptchaToken": "test-token"})

        # Response checks
    assert response.status_code == 200
    data = response.json()
    assert data["msg"] == expected_msg
    assert data["user"]["uid"] == fake_uid
    if fake_profile:
        assert data["user"]["name"] == fake_profile["name"]
        assert data["user"]["email"] == fake_profile["email"]
    else:
        assert data["user"]["name"] == token_name
        assert data["user"]["email"] == token_email

    # Cookie should be set
    cookie = response.cookies.get(appmod.SESSION_COOKIE_NAME)
    assert cookie is not None
    assert len(cookie) > 0

    # Redis call check
    mock_redis.hset.assert_awaited_once()
    called_mapping = mock_redis.hset.call_args[1]["mapping"]
    assert called_mapping["uid"] == fake_uid
    if fake_profile:
        assert called_mapping["name"] == fake_profile["name"]
        assert called_mapping["email"] == fake_profile["email"]
    else:
        assert called_mapping["name"] == token_name
        assert called_mapping["email"] == token_email

    # Firestore .set() for new users
    if not fake_profile:
        mock_set = mock_db.collection.return_value.document.return_value.set
        mock_set.assert_called_once()
        created_payload = mock_set.call_args[0][0]
        assert created_payload["uid"] == fake_uid
        assert created_payload["name"] == token_name
        assert created_payload["email"] == token_email
        assert created_payload["auth_provider"] == "google"
        assert created_payload["questions"] == []