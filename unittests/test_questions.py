import os, sys, importlib
from pathlib import Path
from unittest.mock import patch, MagicMock, PropertyMock
from fastapi.testclient import TestClient
from src.server.server import SESSION_COOKIE_NAME, app, QuestionRequest
import pytest


client = TestClient(app)

def test_get_question_2():

    fake_question = {
        "answerCriteria":"Could be anything.",
        "avgScore":1,
        "id":2,
        "numAttempts":0,
        "question":"Where do you see yourself in five years?"


    }

    # patch in db and such
    with patch("src.server.server.db") as mock_db:

        fake_doc = MagicMock()
        fake_doc.exists = True
        fake_doc.to_dict.return_value = fake_question

        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc
        question_id = 2
        question_class = {"questionId":question_id}
        requestClass = QuestionRequest(**question_class)
        assert requestClass.dict() == {"questionId": 2}

        response = client.post("/api/question/id", json=requestClass.dict())

        assert response.status_code == 200
        data = response.json()
        assert data["answerCriteria"] == "Could be anything."
        assert data["avgScore"] == 1
        assert data["id"] == 2 and data["id"] == question_id


# parameterize on failure of many cases

@pytest.mark.parametrize(
    "badId",
    [
        (-1),
        (1000000),
        ("fish")
    ]
)
def test_question(badId):
    '''
    Testing a bad ID for search. should always just return the default dict
    '''
    with patch("src.server.server.db") as mock_db:

        fake_doc = MagicMock()
        fake_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = fake_doc

        payload = {"questionId": badId}
        response = client.post("/api/question/id", json=payload)

        if isinstance(badId, str):  # Pydantic validation will fail
            assert response.status_code == 422
        else:
            assert response.status_code == 200
            data = response.json()
            assert "question" in data
            assert "answerCriteria" in data
            assert data["avgScore"] == 1



