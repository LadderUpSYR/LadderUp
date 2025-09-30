import os, sys, importlib
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

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

def _load_app():
    """
    Import src/server/server.py with firebase patched so we don't need real creds.
    Returns (appmod, client, fakedb)
    """

    for mod in ("server.server",):
        if mod in sys.modules: del sys.modules[mod]

        env = {
        "GOOGLE_CLIENT_ID": "test-client-id",
        "FIREBASE_SERVICE_ACCOUNT_KEY": "{}",
        }

        with patch.dict(os.environ, env, clear=False), \
            patch("firebase_admin.initialize_app", lambda *a, **k: None), \
            patch("firebase_admin.credentials.Certificate", lambda *a, **k: object()), \
            patch("firebase_admin.firestore.client", lambda: object()):

            from server import server as appmod

    fakedb = _DB()
    appmod.db = fakedb
    appmod.GOOGLE_CLIENT_ID = "test-client-id"

    client = TestClient(appmod.app)
    return appmod, client, fakedb

# ---------------- tests ----------------

def test_health_ok():
    appmod, client, _ = _load_app()
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}

def test_missing_token_400():
    appmod, client, _ = _load_app()
    r = client.post("/api/auth/login", json={})
    assert r.status_code == 400
    assert r.json()["detail"] == "Missing token"

def test_invalid_token_401():
    appmod, client, _ = _load_app()
    with patch.object(appmod.id_token, "verify_oauth2_token", side_effect=Exception("bad")):
        r = client.post("/api/auth/login", json={"token": "BAD"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"

def test_new_user_created_200():
    appmod, client, fakedb = _load_app()
    idinfo = {"sub": "uid123", "email": "u@example.com", "name": "User One"}
    with patch.object(appmod.id_token, "verify_oauth2_token", return_value=idinfo):
        r = client.post("/api/auth/login", json={"token": "GOOD"})
    assert r.status_code == 200
    body = r.json()
    assert body["msg"] == "New user created"
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
    assert body["msg"] == "User exists"
    assert body["uid"] == "uidX"
    assert body["profile"]["name"] == "Existing"