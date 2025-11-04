import os, sys
# 💡 Change MagicMock to AsyncMock for the redis client
from unittest.mock import patch, MagicMock, AsyncMock 
from unittests.test_auth_login import load_app_with_env
import pytest
from datetime import datetime, timedelta, timezone # Need these for the mock data

def test_profilepage_shows_user_with_answered_question(load_app_with_env):
    """
    Simulate a user who logged in and has answered one question...
    """

    appmod, client, fakedb = load_app_with_env

    fake_uid = "user123"
    fake_profile = {
        "name": "ProfileTester",
        "email": "prof@test.com",
        # store a minimal questions structure matching app expectations
        "questions": [
            {
                "questionId": 2,
                "question": "Where do you see yourself in five years?",
                "answer": "Leading product at a mission-driven org",
                "score": 4,
                "date": "2025-10-05"
            }
        ],
        "is_admin": False
    }
    
    # 💡 Data that Redis needs to return for a successful /api/auth/me
    # Calculate a valid expiration time for the mock session
    expires_timestamp = str((datetime.now(timezone.utc) + timedelta(days=7)).timestamp())
    mock_session_data = {
        "uid": fake_uid,
        "name": fake_profile["name"],
        "email": fake_profile["email"],
        "expires": expires_timestamp,
    }


    # Pre-populate the fake DB's users store for this uid
    fakedb.users[fake_uid] = fake_profile

    # Patch Google verification, DB, AND Redis
    # 💡 Use AsyncMock for redis_client
    with patch("src.server_comps.server.id_token.verify_oauth2_token") as mock_verify, \
         patch("src.server_comps.server.db") as mock_db, \
         patch("src.server_comps.server.redis_client", new_callable=AsyncMock) as mock_redis: 

        mock_verify.return_value = {"sub": fake_uid, "email": fake_profile["email"], "name": fake_profile["name"]}

        # Mock Firestore response for user lookup
        fake_doc = MagicMock()
        fake_doc.exists = True
        fake_doc.to_dict.return_value = fake_profile
        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc

        # 💡 Set up the mock to return the session data when /api/auth/me calls hgetall
        mock_redis.hgetall.return_value = mock_session_data
        
        # Call login endpoint to set session cookie
        response = client.post("/api/auth/login", json={"token": "FAKE_TOKEN"})

        assert response.status_code == 200
        data = response.json()
        assert data["user"]["uid"] == fake_uid
        assert data["user"]["name"] == fake_profile["name"]

        # The TestClient has the session cookie set; now call /api/auth/me to verify
        # This is now inside the patch block AND the mock is configured for async retrieval.

        r = client.get("/api/auth/me")
        assert r.status_code == 200
        me = r.json()["user"]
        assert me["uid"] == fake_uid
        assert me["name"] == fake_profile["name"]
        assert me["email"] == fake_profile["email"]

    # Verify the fake DB still has the answered question (This check is fine outside the patch block)
    assert fake_uid in fakedb.users
    stored = fakedb.users[fake_uid]
    assert "questions" in stored
    assert isinstance(stored["questions"], list)
    assert len(stored["questions"]) == 1
    q = stored["questions"][0]
    assert q["questionId"] == 2
    assert "answer" in q
    assert q["score"] == 4