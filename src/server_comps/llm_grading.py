"""
LLM-based interview answer grading service using Google Gemini API.
Provides detailed scoring and feedback for interview responses.
"""
import os
import google.generativeai as genai
from typing import Dict, Optional
from dotenv import load_dotenv
from src.utils.yamlparser import yaml_parser

load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class InterviewGrader:
    """Grades interview answers using Google Gemini AI"""
    
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        """
        Initialize the grader with a specific Gemini model.
        
        Args:
            model_name: The Gemini model to use. Default is gemini-2.5-flash.
                       Other options: gemini-2.5-pro (for more detailed analysis)
        """
        self.model_name = model_name
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        # Initialize the model
        self.model = genai.GenerativeModel(model_name)
    

    # This question needs to be updated to use the Question class, such that the yaml parser can be used
    # todo implementation of player uuid passing aswell
    def grade_answer(self, question: str, answer: str, criteria: Optional[str] = None) -> Dict:
        """
        Grade an interview answer using Gemini AI.
        
        Args:
            question: The interview question that was asked
            answer: The candidate's response
            criteria: Optional grading criteria or guidelines
            
        Returns:
            Dict containing:
                - score (float): Score from 1-10
                - feedback (str): Detailed feedback on the answer
                - strengths (list): Key strengths identified
                - improvements (list): Suggested areas for improvement
        """
        # Build the grading prompt
        # criteria needs to come from the yaml parser


        #criteria = yaml_parser(question, "player_uuid_placeholder") # TODO: replace with actual player UUID

        prompt = self._build_grading_prompt(question, answer, criteria)
        
        try:
            # Generate response from Gemini
            response = self.model.generate_content(prompt)
            
            # Parse the response
            result = self._parse_gemini_response(response.text)
            return result
            
        except Exception as e:
            print(f"Error grading with Gemini: {e}")
            # Return a fallback response
            return {
                "score": 5.0,
                "feedback": f"Unable to grade answer automatically. Error: {str(e)}",
                "strengths": ["Answer provided"],
                "improvements": ["Please try again"],
                "error": True
            }
    
    def _build_grading_prompt(self, question: str, answer: str, criteria: Optional[str]) -> str:
        """Build the prompt for Gemini to grade the interview answer"""
        
        base_prompt = f"""You are an expert interview coach evaluating a candidate's response to a behavioral interview question.

INTERVIEW QUESTION:
{question}

CANDIDATE'S ANSWER:
{answer}
"""
        
        if criteria:
            base_prompt += f"""
GRADING CRITERIA:
{criteria}
"""
        
        base_prompt += """
Please evaluate this answer and provide:

1. A numerical score from 1-10 where:
   - 1-3: Poor answer (vague, off-topic, or minimal effort)
   - 4-5: Below average (missing key elements or lacks clarity)
   - 6-7: Good answer (covers basics, could be more detailed)
   - 8-9: Excellent answer (well-structured, specific examples, clear)
   - 10: Outstanding answer (exemplary in all aspects)

2. Detailed feedback explaining your score

3. Key strengths (2-3 positive aspects of the answer)

4. Areas for improvement (2-3 specific suggestions)

Format your response EXACTLY as follows:
SCORE: [number from 1-10]
FEEDBACK: [your detailed feedback here]
STRENGTHS:
- [strength 1]
- [strength 2]
- [strength 3]
IMPROVEMENTS:
- [improvement 1]
- [improvement 2]
- [improvement 3]

Be constructive, specific, and helpful in your evaluation.
"""
        return base_prompt
    
    def _parse_gemini_response(self, response_text: str) -> Dict:
        """Parse the structured response from Gemini"""
        result = {
            "score": 5.0,
            "feedback": "",
            "strengths": [],
            "improvements": []
        }
        
        lines = response_text.strip().split('\n')
        current_section = None
        
        for line in lines:
            line = line.strip()
            
            if line.startswith("SCORE:"):
                # Extract score
                score_str = line.replace("SCORE:", "").strip()
                try:
                    score = float(score_str)
                    result["score"] = max(1.0, min(10.0, score))  # Clamp between 1-10
                except ValueError:
                    # Try to extract just the number if there's extra text
                    import re
                    match = re.search(r'(\d+\.?\d*)', score_str)
                    if match:
                        result["score"] = float(match.group(1))
                        
            elif line.startswith("FEEDBACK:"):
                current_section = "feedback"
                result["feedback"] = line.replace("FEEDBACK:", "").strip()
                
            elif line.startswith("STRENGTHS:"):
                current_section = "strengths"
                
            elif line.startswith("IMPROVEMENTS:"):
                current_section = "improvements"
                
            elif line.startswith("-") or line.startswith("•"):
                # Bullet point item
                item = line.lstrip("-•").strip()
                if current_section == "strengths" and item:
                    result["strengths"].append(item)
                elif current_section == "improvements" and item:
                    result["improvements"].append(item)
                    
            elif current_section == "feedback" and line:
                # Continue multi-line feedback
                result["feedback"] += " " + line
        
        # Ensure we have at least something in each field
        if not result["feedback"]:
            result["feedback"] = "Answer received and reviewed."
        if not result["strengths"]:
            result["strengths"] = ["Response provided"]
        if not result["improvements"]:
            result["improvements"] = ["Keep practicing"]
            
        return result


# Create a singleton instance for easy import
_grader_instance = None

def get_grader() -> InterviewGrader:
    """Get or create the singleton grader instance"""
    global _grader_instance
    if _grader_instance is None:
        _grader_instance = InterviewGrader()
    return _grader_instance
