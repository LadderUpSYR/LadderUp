from fastapi import HTTPException
import random
from typing import Dict, Any

# --- FIX: IMPORT FROM DATABASE.PY ---
from src.server_comps.database import db

class QuestionManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(QuestionManager, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "initialized", False):
            return
        self.initialized = True

    async def get_question_by_id(self, question_id: int) -> Dict[str, Any]:
        try:
            qs = db.collection("questions").document(str(question_id)).get()
            if qs.exists:
                return qs.to_dict()
            else:
                return {
                    "answerCriteria": "This question should follow the STAR principle. They can answer in many ways, but should be short (maximum of one minute or ten sentences).",
                    "avgScore": 1,
                    "numAttempts": 0,
                    "question": "Tell us about a time you had a great team member. How did they make the project better?"
                }
        except Exception as e:
            print(f"Error fetching question {question_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch question")

    async def get_random_question(self) -> Dict[str, Any]:
        try:
            questions = db.collection("questions").stream()
            all_questions = []
            for q in questions:
                question_data = q.to_dict()
                question_data["questionId"] = q.id
                all_questions.append(question_data)

            if not all_questions:
                return {
                    "questionId": "default-1",
                    "answerCriteria": "This question should follow the STAR principle...",
                    "avgScore": 1,
                    "numAttempts": 0,
                    "question": "Tell us about a time you had a great team member..."
                }
            
            return random.choice(all_questions)
        except Exception as e:
            print("Error fetching random question:", e)
            raise HTTPException(status_code=500, detail="Failed to fetch random question")