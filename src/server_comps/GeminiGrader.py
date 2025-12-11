"""
Google Gemini implementation of the interview grader.
Uses Google's Generative AI API for grading interview answers.
"""
import os
from typing import Dict, Optional

import google.generativeai as genai
from dotenv import load_dotenv

from src.server_comps.InterviewGrader import InterviewGrader

load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class GeminiGrader(InterviewGrader):
    """
    Interview grader implementation using Google Gemini AI.
    
    Supports multiple Gemini models including:
    - gemini-2.5-flash (default, fast responses)
    - gemini-2.5-pro (more detailed analysis)
    """
    
    DEFAULT_MODEL = "gemini-2.5-flash"
    
    def __init__(self, model_name: str = DEFAULT_MODEL):
        """
        Initialize the Gemini grader.
        
        Args:
            model_name: The Gemini model to use. Default is gemini-2.5-flash.
                       Other options: gemini-2.5-pro (for more detailed analysis)
        """
        super().__init__(model_name)
        self._initialize_model()
    
    def _initialize_model(self) -> None:
        """Initialize the connection to Gemini API."""
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        # Initialize the model - this creates a connection to Gemini's API
        self.model = genai.GenerativeModel(self.model_name)
    
    def _generate_response(self, prompt: str) -> str:
        """
        Generate a response from Gemini.
        
        Args:
            prompt: The complete prompt to send to Gemini
            
        Returns:
            The raw text response from Gemini
        """
        response = self.model.generate_content(prompt)
        return response.text
    
    def _build_grading_prompt(
        self, 
        question: str, 
        answer: str, 
        criteria: Optional[str], 
        video_analytics: Optional[Dict] = None
    ) -> str:
        """
        Build the prompt for Gemini to grade the interview answer.
        
        Uses the standard grading prompt from the base class.
        
        Args:
            question: The interview question text
            answer: The candidate's answer
            criteria: Optional grading criteria
            video_analytics: Optional video analysis metrics
            
        Returns:
            The complete prompt string
        """
        # Use the standard prompt from base class
        return self._build_standard_grading_prompt(question, answer, criteria, video_analytics)
    
    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "Gemini"
