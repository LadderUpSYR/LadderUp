# src/services/answer_service.py
"""
Middleware that grades answers with LLM and saves them to Firebase
"""

from datetime import datetime, timezone
from typing import Dict
from src.utils.yamlparser import Question


async def answer_to_db_middleware(
    answer: str, 
    question_id: str, 
    player_uuid: str
) -> Dict:
    """
    Grade an answer using LLM and save it to the user's Firebase record.
    
    Args:
        answer: The user's answer text
        question_id: ID of the question being answered
        player_uuid: UUID of the user/player
        
    Returns:
        Dict: The answer record that was saved
        
    Raises:
        ValueError: If question or user not found
    """
    # Import here to avoid circular imports
    from src.server_comps.server import db
    from src.server_comps.llm_grading import get_grader
    print("got here")
    # Get the question from database
    question_doc = db.collection("questions").document(question_id).get()
    
    if not question_doc.exists:
        raise ValueError(f"Question {question_id} not found")
    
    question_data = question_doc.to_dict()
    question = Question(
        id=question_data["id"],
        question=question_data["question"],
        answer_criteria=question_data.get("answer_criteria"),
        passing_score=question_data.get("passing_score", 7.0),
        avg_score=question_data.get("avg_score", 1.0),
        num_attempts=question_data.get("num_attempts", 0),
        metadata_yaml=question_data.get("metadata_yaml")
    )
    
    # Grade the answer with LLM
    grader = get_grader()
    grading_result = grader.grade_answer(
        question=question,
        answer=answer,
        player_uuid=player_uuid
    )
    
    # Get user's current profile
    user_ref = db.collection("users").document(player_uuid)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        raise ValueError(f"User {player_uuid} not found")
    
    user_data = user_doc.to_dict()
    answered_questions = user_data.get("answered_questions", [])
    
    # Create answer record
    answer_record = {
        "questionId": question.id,
        "question": question.question,
        "answer": answer,
        "score": grading_result["score"],
        "feedback": grading_result["feedback"],
        "strengths": grading_result["strengths"],
        "improvements": grading_result["improvements"],
        "date": datetime.now(timezone.utc).isoformat(),
        "gradedBy": "gemini-ai"
    }
    
    # Check if question was already answered - update with latest score
    existing_index = None
    for i, q in enumerate(answered_questions):
        if q.get("questionId") == question_id:
            existing_index = i
            break
    
    if existing_index is not None:
        # Update existing answer
        answered_questions[existing_index] = answer_record
        print(f"Updated existing answer for question {question_id}")
    else:
        # Add new answer
        answered_questions.append(answer_record)
        print(f"Added new answer for question {question_id}")
    
    # Save to Firebase
    user_ref.update({"answered_questions": answered_questions})
    
    print(f"Saved graded answer to Firebase for user {player_uuid}")
    return answer_record