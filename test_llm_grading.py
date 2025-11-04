"""
Test script for LLM grading functionality.
Run this to verify the Gemini integration is working correctly.
"""
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server_comps.llm_grading import InterviewGrader

def test_basic_grading():
    """Test basic grading functionality"""
    print("=" * 60)
    print("Testing LLM Interview Grading")
    print("=" * 60)
    
    try:
        grader = InterviewGrader()
        print("✓ Grader initialized successfully\n")
    except ValueError as e:
        print(f"✗ Error: {e}")
        print("\nMake sure GEMINI_API_KEY is set in your .env file")
        return False
    
    # Test case 1: Good answer
    print("Test Case 1: Good Answer")
    print("-" * 60)
    question1 = "Tell me about a time when you had to work with a difficult team member."
    answer1 = """In my previous role as a software developer, I worked with a team member 
    who was resistant to code reviews and often pushed untested code. I scheduled a private 
    conversation where I explained how code reviews benefit the entire team and reduce bugs. 
    I also offered to pair program with them to address their concerns about feedback. 
    As a result, they became more receptive to reviews, and our team's code quality improved 
    by 30% over the next quarter."""
    
    result1 = grader.grade_answer(question1, answer1)
    
    print(f"Question: {question1}")
    print(f"\nAnswer: {answer1}")
    print(f"\nScore: {result1['score']}/10")
    print(f"\nFeedback: {result1['feedback']}")
    print("\nStrengths:")
    for strength in result1['strengths']:
        print(f"  ✓ {strength}")
    print("\nImprovements:")
    for improvement in result1['improvements']:
        print(f"  → {improvement}")
    
    print("\n" + "=" * 60)
    
    # Test case 2: Poor answer
    print("\nTest Case 2: Weak Answer")
    print("-" * 60)
    question2 = "Describe a challenging project you completed."
    answer2 = "I worked on a project and it was hard but I finished it."
    
    result2 = grader.grade_answer(question2, answer2)
    
    print(f"Question: {question2}")
    print(f"\nAnswer: {answer2}")
    print(f"\nScore: {result2['score']}/10")
    print(f"\nFeedback: {result2['feedback']}")
    print("\nStrengths:")
    for strength in result2['strengths']:
        print(f"  ✓ {strength}")
    print("\nImprovements:")
    for improvement in result2['improvements']:
        print(f"  → {improvement}")
    
    print("\n" + "=" * 60)
    
    # Test case 3: With criteria
    print("\nTest Case 3: Grading with STAR Criteria")
    print("-" * 60)
    question3 = "Tell me about a time you demonstrated leadership."
    answer3 = """During a critical product launch, our project manager fell ill. I stepped up 
    to coordinate the team. I organized daily standups, delegated tasks based on team members' 
    strengths, and maintained communication with stakeholders. We successfully launched on time, 
    and the product exceeded first-month sales targets by 25%."""
    criteria3 = "Answer should follow STAR method: Situation, Task, Action, Result"
    
    result3 = grader.grade_answer(question3, answer3, criteria3)
    
    print(f"Question: {question3}")
    print(f"\nCriteria: {criteria3}")
    print(f"\nAnswer: {answer3}")
    print(f"\nScore: {result3['score']}/10")
    print(f"\nFeedback: {result3['feedback']}")
    print("\nStrengths:")
    for strength in result3['strengths']:
        print(f"  ✓ {strength}")
    print("\nImprovements:")
    for improvement in result3['improvements']:
        print(f"  → {improvement}")
    
    print("\n" + "=" * 60)
    print("✓ All tests completed successfully!")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    print("\nLLM Grading Test Suite")
    print("Make sure you have:")
    print("1. Installed dependencies: pip install -r requirements.txt")
    print("2. Set GEMINI_API_KEY in your .env file")
    print("3. Internet connection for API access\n")
    
    input("Press Enter to continue...")
    
    success = test_basic_grading()
    
    if success:
        print("\n✓ Integration is working correctly!")
        print("You can now test it in the Question Debug page of the app.")
    else:
        print("\n✗ There was an error. Please check your configuration.")
    
    sys.exit(0 if success else 1)
