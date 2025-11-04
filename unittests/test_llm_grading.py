"""
Unit tests for LLM-based interview grading functionality.
Tests the InterviewGrader class and its integration with Gemini API.
"""
import unittest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.server.llm_grading import InterviewGrader, get_grader


class TestInterviewGrader(unittest.TestCase):
    """Test cases for the InterviewGrader class"""
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_grader_initialization(self, mock_model):
        """Test that grader initializes with correct model"""
        grader = InterviewGrader()
        
        self.assertEqual(grader.model_name, "gemini-2.5-flash")
        mock_model.assert_called_once_with("gemini-2.5-flash")
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', None)
    def test_grader_initialization_without_api_key(self):
        """Test that grader raises error without API key"""
        with self.assertRaises(ValueError) as context:
            InterviewGrader()
        
        self.assertIn("GEMINI_API_KEY not found", str(context.exception))
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_grader_with_custom_model(self, mock_model):
        """Test grader initialization with custom model"""
        grader = InterviewGrader(model_name="gemini-2.5-pro")
        
        self.assertEqual(grader.model_name, "gemini-2.5-pro")
        mock_model.assert_called_once_with("gemini-2.5-pro")
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_grade_answer_success(self, mock_model_class):
        """Test successful grading of an answer"""
        # Mock the Gemini response
        mock_response = Mock()
        mock_response.text = """SCORE: 8
FEEDBACK: This is a strong answer that demonstrates clear understanding of the STAR method.
STRENGTHS:
- Provided specific example with clear context
- Demonstrated problem-solving skills
- Included measurable results
IMPROVEMENTS:
- Could add more detail about the team dynamics
- Consider mentioning specific tools or technologies used
- Elaborate on long-term impact"""
        
        mock_model = Mock()
        mock_model.generate_content.return_value = mock_response
        mock_model_class.return_value = mock_model
        
        grader = InterviewGrader()
        result = grader.grade_answer(
            question="Tell me about a time you solved a problem.",
            answer="I identified a bug in production and fixed it quickly.",
            criteria="Use STAR method"
        )
        
        # Verify the result structure
        self.assertIn('score', result)
        self.assertIn('feedback', result)
        self.assertIn('strengths', result)
        self.assertIn('improvements', result)
        
        # Verify score is correct
        self.assertEqual(result['score'], 8.0)
        
        # Verify feedback is present
        self.assertIn("strong answer", result['feedback'])
        
        # Verify strengths list
        self.assertEqual(len(result['strengths']), 3)
        self.assertIn("specific example", result['strengths'][0].lower())
        
        # Verify improvements list
        self.assertEqual(len(result['improvements']), 3)
        
        # Verify generate_content was called
        mock_model.generate_content.assert_called_once()
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_grade_answer_with_decimal_score(self, mock_model_class):
        """Test grading with decimal score"""
        mock_response = Mock()
        mock_response.text = """SCORE: 7.5
FEEDBACK: Good answer with room for improvement.
STRENGTHS:
- Clear communication
IMPROVEMENTS:
- Add more details"""
        
        mock_model = Mock()
        mock_model.generate_content.return_value = mock_response
        mock_model_class.return_value = mock_model
        
        grader = InterviewGrader()
        result = grader.grade_answer("Question", "Answer")
        
        self.assertEqual(result['score'], 7.5)
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_grade_answer_score_clamping(self, mock_model_class):
        """Test that scores are clamped between 1 and 10"""
        # Test score above 10
        mock_response = Mock()
        mock_response.text = """SCORE: 15
FEEDBACK: Perfect answer.
STRENGTHS:
- Excellent
IMPROVEMENTS:
- None"""
        
        mock_model = Mock()
        mock_model.generate_content.return_value = mock_response
        mock_model_class.return_value = mock_model
        
        grader = InterviewGrader()
        result = grader.grade_answer("Question", "Answer")
        
        # Score should be clamped to 10
        self.assertEqual(result['score'], 10.0)
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_grade_answer_api_error_fallback(self, mock_model_class):
        """Test that grading handles API errors gracefully"""
        mock_model = Mock()
        mock_model.generate_content.side_effect = Exception("API Error")
        mock_model_class.return_value = mock_model
        
        grader = InterviewGrader()
        result = grader.grade_answer("Question", "Answer")
        
        # Should return fallback response
        self.assertEqual(result['score'], 5.0)
        self.assertIn('error', result)
        self.assertTrue(result['error'])
        self.assertIn("Unable to grade", result['feedback'])
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_build_grading_prompt(self, mock_model_class):
        """Test that grading prompt is built correctly"""
        mock_model_class.return_value = Mock()
        
        grader = InterviewGrader()
        
        # Test with criteria
        prompt_with_criteria = grader._build_grading_prompt(
            "Test question",
            "Test answer",
            "Use STAR method"
        )
        
        self.assertIn("Test question", prompt_with_criteria)
        self.assertIn("Test answer", prompt_with_criteria)
        self.assertIn("Use STAR method", prompt_with_criteria)
        self.assertIn("SCORE:", prompt_with_criteria)
        self.assertIn("FEEDBACK:", prompt_with_criteria)
        self.assertIn("STRENGTHS:", prompt_with_criteria)
        self.assertIn("IMPROVEMENTS:", prompt_with_criteria)
        
        # Test without criteria
        prompt_without_criteria = grader._build_grading_prompt(
            "Test question",
            "Test answer",
            None
        )
        
        self.assertIn("Test question", prompt_without_criteria)
        self.assertIn("Test answer", prompt_without_criteria)
        self.assertNotIn("GRADING CRITERIA:", prompt_without_criteria)
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_parse_gemini_response(self, mock_model_class):
        """Test parsing of various Gemini response formats"""
        mock_model_class.return_value = Mock()
        grader = InterviewGrader()
        
        # Test standard response
        response_text = """SCORE: 8.5
FEEDBACK: Good answer with specific examples.
STRENGTHS:
- Clear structure
- Specific examples
- Good conclusion
IMPROVEMENTS:
- Add more metrics
- Mention stakeholders
- Discuss challenges"""
        
        result = grader._parse_gemini_response(response_text)
        
        self.assertEqual(result['score'], 8.5)
        self.assertIn("Good answer", result['feedback'])
        self.assertEqual(len(result['strengths']), 3)
        self.assertEqual(len(result['improvements']), 3)
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_parse_gemini_response_with_bullets(self, mock_model_class):
        """Test parsing response with bullet point variations"""
        mock_model_class.return_value = Mock()
        grader = InterviewGrader()
        
        # Test with different bullet styles
        response_text = """SCORE: 7
FEEDBACK: Decent answer.
STRENGTHS:
• First strength with bullet
- Second strength with dash
- Third strength
IMPROVEMENTS:
• First improvement
- Second improvement
• Third improvement"""
        
        result = grader._parse_gemini_response(response_text)
        
        self.assertEqual(len(result['strengths']), 3)
        self.assertEqual(len(result['improvements']), 3)
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_parse_gemini_response_missing_sections(self, mock_model_class):
        """Test parsing handles missing sections gracefully"""
        mock_model_class.return_value = Mock()
        grader = InterviewGrader()
        
        # Response with missing sections
        response_text = """SCORE: 6"""
        
        result = grader._parse_gemini_response(response_text)
        
        # Should have defaults
        self.assertEqual(result['score'], 6.0)
        self.assertIsNotNone(result['feedback'])
        self.assertGreater(len(result['strengths']), 0)
        self.assertGreater(len(result['improvements']), 0)
    
    @patch('src.server.llm_grading._grader_instance', None)
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_get_grader_singleton(self, mock_model_class):
        """Test that get_grader returns singleton instance"""
        mock_model_class.return_value = Mock()
        
        grader1 = get_grader()
        grader2 = get_grader()
        
        # Should be the same instance
        self.assertIs(grader1, grader2)
    
    @patch('src.server.llm_grading.GEMINI_API_KEY', 'test_api_key')
    @patch('src.server.llm_grading.genai.GenerativeModel')
    def test_grade_answer_multiline_feedback(self, mock_model_class):
        """Test parsing of multi-line feedback"""
        mock_response = Mock()
        mock_response.text = """SCORE: 7
FEEDBACK: This is a good answer that demonstrates understanding.
It shows clear communication and problem-solving skills.
However, it could benefit from more specific examples.
STRENGTHS:
- Good structure
IMPROVEMENTS:
- Add examples"""
        
        mock_model = Mock()
        mock_model.generate_content.return_value = mock_response
        mock_model_class.return_value = mock_model
        
        grader = InterviewGrader()
        result = grader.grade_answer("Question", "Answer")
        
        # Multi-line feedback should be combined
        self.assertIn("demonstrates understanding", result['feedback'])
        self.assertIn("problem-solving skills", result['feedback'])


class TestGraderIntegration(unittest.TestCase):
    """Integration tests requiring actual API key (skipped if not available)"""
    
    def setUp(self):
        """Check if API key is available"""
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            self.skipTest("GEMINI_API_KEY not set, skipping integration tests")
    
    def test_real_api_call(self):
        """Test actual API call with real Gemini API (requires API key)"""
        grader = InterviewGrader()
        
        result = grader.grade_answer(
            question="Tell me about a time you worked in a team.",
            answer="I worked with my team on a project and we completed it successfully.",
            criteria="Answer should follow STAR method"
        )
        
        # Verify response structure
        self.assertIn('score', result)
        self.assertIn('feedback', result)
        self.assertIn('strengths', result)
        self.assertIn('improvements', result)
        
        # Verify score is in valid range
        self.assertGreaterEqual(result['score'], 1.0)
        self.assertLessEqual(result['score'], 10.0)
        
        # Verify we got actual content
        self.assertGreater(len(result['feedback']), 10)
        self.assertGreater(len(result['strengths']), 0)
        self.assertGreater(len(result['improvements']), 0)
    
    def test_good_vs_poor_answer_scoring(self):
        """Test that good answers score higher than poor answers"""
        grader = InterviewGrader()
        
        good_answer = """When I was a team lead at TechCorp, our main database server crashed during peak hours. 
        I immediately coordinated with the DevOps team to spin up a backup server while I investigated the root cause. 
        I discovered a memory leak in our caching layer and deployed a hotfix within 2 hours. 
        As a result, we restored service with only 15 minutes of downtime and prevented future incidents."""
        
        poor_answer = "I fixed a problem once."
        
        good_result = grader.grade_answer(
            "Tell me about a time you solved a technical problem.",
            good_answer
        )
        
        poor_result = grader.grade_answer(
            "Tell me about a time you solved a technical problem.",
            poor_answer
        )
        
        # Good answer should score higher
        self.assertGreater(good_result['score'], poor_result['score'])


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
