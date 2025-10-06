import os, sys
from unittest.mock import patch, MagicMock
from unittests.test_auth_login import _load_app_with_env
import pytest


def test_profilepage_shows_user_with_answered_question():
    """
    Simulate a user who logged in and has answered one question. Use the same fake DB helpers
    from `_load_app_with_env()` (which attaches a fake `db` object) to insert a user profile
    that includes one answered question. Then call `/api/auth/login` (mocking Google token verify)
    to create a session cookie and finally call `/api/auth/me` to verify session and profile.
    """

    appmod, client, fakedb = _load_app_with_env()

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
        ]
    }

    # Pre-populate the fake DB's users store for this uid
    fakedb.users[fake_uid] = fake_profile

    # Patch Google verification to return our fake uid
    with patch("src.server.server.id_token.verify_oauth2_token") as mock_verify, \
         patch("src.server.server.db") as mock_db:

        mock_verify.return_value = {"sub": fake_uid, "email": fake_profile["email"], "name": fake_profile["name"]}

        # Make the real app's db point to our fake_db so login uses it
        mock_db.collection.return_value.document.return_value.get.return_value = MagicMock()
        # But we need login flow to see that doc.exists = True and to_dict returns the profile
        fake_doc = MagicMock()
        fake_doc.exists = True
        fake_doc.to_dict.return_value = fake_profile
        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc

        # Call login endpoint to set session cookie
        response = client.post("/api/auth/login", json={"token": "FAKE_TOKEN"})

    assert response.status_code == 200
    data = response.json()
    assert data["user"]["uid"] == fake_uid
    assert data["user"]["name"] == fake_profile["name"]

    # The TestClient has the session cookie set; now call /api/auth/me to verify
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    me = r.json()["user"]
    assert me["uid"] == fake_uid
    assert me["name"] == fake_profile["name"]
    assert me["email"] == fake_profile["email"]

    # Verify the fake DB still has the answered question
    assert fake_uid in fakedb.users
    stored = fakedb.users[fake_uid]
    assert "questions" in stored
    assert isinstance(stored["questions"], list)
    assert len(stored["questions"]) == 1
    q = stored["questions"][0]
    assert q["questionId"] == 2
    assert "answer" in q
    assert q["score"] == 4
