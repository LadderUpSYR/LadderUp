from unittest.mock import patch, MagicMock, AsyncMock
import pytest
from fastapi.testclient import TestClient

# Import your helper to load app with patched env
from .test_auth_login import load_app_with_env  # or define _load_app_with_env() in this file

# ----------------- Tests -----------------

def test_login_existing_user(load_app_with_env):
    appmod, client, _ = load_app_with_env
    uid = "67890"
    email = "existing@example.com"
    fake_profile = {"name": "Existing User", "email": email, "questions": [True, False, True]}

    with patch("src.server_comps.server.id_token.verify_oauth2_token") as mock_verify, \
         patch("src.server_comps.server.db") as mock_db, \
         patch("src.server_comps.server.redis_client") as mock_redis:

        # Patch Google verification
        mock_verify.return_value = {"sub": uid, "email": email, "name": "Existing User"}

        # Patch Firestore
        fake_doc = MagicMock()
        fake_doc.exists = True
        fake_doc.to_dict.return_value = fake_profile
        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc

        # Patch Redis with all required async operations
        mock_redis.hset = AsyncMock(return_value=True)
        mock_redis.expire = AsyncMock(return_value=True)
        mock_redis.hgetall = AsyncMock(return_value={})
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.set = AsyncMock(return_value=True)

        # Call endpoint
        response = client.post("/api/auth/login", json={"token": "FAKE_TOKEN", "recaptchaToken": "test-token"})

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["msg"] == "User Exists"
        assert data["user"]["uid"] == uid
        assert data["user"]["name"] == fake_profile["name"]
        assert data["user"]["email"] == fake_profile["email"]

        # Session cookie check
        cookie = response.cookies.get(appmod.SESSION_COOKIE_NAME)
        assert cookie is not None
        assert len(cookie) > 0
