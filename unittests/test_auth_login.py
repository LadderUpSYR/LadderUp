import os, sys, importlib
from pathlib import Path
from unittest.mock import patch, MagicMock, PropertyMock
from fastapi.testclient import TestClient
from src.server.server import SESSION_COOKIE_NAME, app
import pytest


SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

class _Doc:
    def __init__(self, exists, data=None): self._e, self._d = exists, data or {}
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

class _DB:
    def __init__(self): self.users = {}
    def collection(self, name):
        assert name == "users"
        return _Collection(self.users)

def _load_app_with_env():
    # Provide fake FIREBASE_SERVICE_ACCOUNT_KEY so server.py does not fail
    env = {
        "GOOGLE_CLIENT_ID": "test-client-id",
        "FIREBASE_SERVICE_ACCOUNT_KEY": "{}"  # empty JSON string works for patching
    }

    with patch.dict(os.environ, env, clear=False), \
         patch("firebase_admin.initialize_app", lambda *a, **k: None), \
         patch("firebase_admin.credentials.Certificate", lambda *a, **k: object()), \
         patch("firebase_admin.firestore.client", lambda: object()):
        
        # import after env patch
        from src.server import server as appmod

    # attach fake db
    fakedb = _DB()
    appmod.db = fakedb
    appmod.GOOGLE_CLIENT_ID = "test-client-id"
    client = TestClient(appmod.app)
    return appmod, client, fakedb


# ---------------- tests ----------------

def test_health_ok():
    appmod, client, _ = _load_app_with_env()
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}

def test_missing_token_400():
    appmod, client, _ = _load_app_with_env()
    r = client.post("/api/auth/login", json={})
    assert r.status_code == 400
    assert r.json()["detail"] == "Missing token"

def test_invalid_token_401():
    appmod, client, _ = _load_app_with_env()
    with patch.object(appmod.id_token, "verify_oauth2_token", side_effect=Exception("bad")):
        r = client.post("/api/auth/login", json={"token": "BAD"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"


#
# The two following tests are already covered in test_userlogin.py
# commenting out for now, unless we can explain logically what is different
# between the files
'''
def test_new_user_created_200():
    appmod, client, fakedb = _load_app()
    idinfo = {"sub": "uid123", "email": "u@example.com", "name": "User One"}
    with patch.object(appmod.id_token, "verify_oauth2_token", return_value=idinfo):
        r = client.post("/api/auth/login", json={"token": "GOOD"})
    assert r.status_code == 200
    body = r.json()
    assert body["msg"] == "New user created"
    body = body["user"]
    assert body["uid"] == "uid123"
    assert body["email"] == "u@example.com"
    assert body["name"] == "User One"
    assert fakedb.users["uid123"]["email"] == "u@example.com"

def test_existing_user_200():
    appmod, client, fakedb = _load_app()
    fakedb.users["uidX"] = {"name": "Existing", "email": "ex@example.com", "questions": []}
    idinfo = {"sub": "uidX", "email": "ex@example.com", "name": "Whatever"}
    with patch.object(appmod.id_token, "verify_oauth2_token", return_value=idinfo):
        r = client.post("/api/auth/login", json={"token": "GOOD"})
    assert r.status_code == 200
    body = r.json()
    assert body["msg"] == "User Exists"
    user = body["user"] # changed to grab this obj instead of what was references as profile?
    assert user["uid"] == "uidX"
    assert user["name"] == "Existing"
'''




@pytest.mark.parametrize(
    "fake_uid,fake_profile,token_email,token_name,expected_msg",
    [
        # New user
        ("12345", None, "cookie@test.com", "CookieUser", "New user created"),
        # Existing user
        ("67890", {"name": "StoredUser", "email": "stored@test.com", "questions": []}, 
         "stored@test.com", "StoredUser", "User Exists")
    ]
)
def test_login_user_sets_cookie(fake_uid, fake_profile, token_email, token_name, expected_msg):
    """
    Test login endpoint for both new and existing users, verifying Firestore calls, response, and session cookie.
    """

    appmod, client, _ = _load_app_with_env()
    with patch("src.server.server.id_token.verify_oauth2_token") as mock_verify, \
         patch("src.server.server.db") as mock_db:

        # Mock Google verification
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

        response = client.post("/api/auth/login", json={"token": "FAKE_TOKEN"})

    # Basic response checks
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

    # Session cache verification
    from src.server import server
    session = server.sessions[cookie]
    assert session["uid"] == fake_uid
    assert session["name"] == data["user"]["name"]
    assert session["email"] == data["user"]["email"]

    # For new users, ensure Firestore .set() was called
    if not fake_profile:
        mock_db.collection.return_value.document.return_value.set.assert_called_once_with({
            "name": token_name,
            "email": token_email,
            "questions": []
        })