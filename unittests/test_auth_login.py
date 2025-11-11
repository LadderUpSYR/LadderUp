"""
Authentication and login tests.

This module tests the FastAPI server's authentication endpoints,
including login, token validation, and session management.
"""

from unittest.mock import patch, MagicMock, AsyncMock

import pytest

# ------------------ Tests ------------------
def test_health_ok(load_app_with_env):
    appmod, client, _ = load_app_with_env
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}

def test_missing_token_400(load_app_with_env):
    appmod, client, _ = load_app_with_env
    r = client.post("/api/auth/login", json={"token": None, "recaptchaToken": "test-token"})
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