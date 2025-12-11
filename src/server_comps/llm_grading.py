"""
LLM-based interview answer grading service.
Provides detailed scoring and feedback for interview responses.

This module serves as the MAIN ENTRY POINT and FACTORY for the grading system.
Its role is to:
1. Load and provide access to different grader implementations (Gemini, OpenAI, etc.)
2. Re-export the base class and implementations for convenience
3. Manage singleton instances of graders for efficient reuse
4. Provide a simple, clean API: get_grader() returns the appropriate grader

Usage:
    from src.server_comps.llm_grading import get_grader
    
    # Get default grader (Gemini)
    grader = get_grader()
    result = grader.grade_answer(question, answer)
    
    # Get specific provider/model
    grader = get_grader("gemini", "gemini-2.5-pro")
"""
from typing import Optional

# Re-export the base class for type hints and inheritance
from src.server_comps.InterviewGrader import InterviewGrader

# Import concrete implementations
from src.server_comps.GeminiGrader import GeminiGrader


# Supported grader providers
GRADER_PROVIDERS = {
    "gemini": GeminiGrader,
    # Future providers can be added here:
    # "openai": OpenAIGrader,
    # "anthropic": AnthropicGrader,
}

DEFAULT_PROVIDER = "gemini"


# Singleton instances for each provider
_grader_instances = {}


def get_grader(
    provider: str = DEFAULT_PROVIDER, 
    model_name: Optional[str] = None
) -> InterviewGrader:
    """
    Get or create a grader instance for the specified provider.
    
    Uses a singleton pattern to reuse grader instances within the same provider.
    
    Args:
        provider: The LLM provider to use ('gemini', etc.)
        model_name: Optional specific model name. If not provided, uses the provider's default.
        
    Returns:
        An InterviewGrader instance for the specified provider
        
    Raises:
        ValueError: If the provider is not supported
        
    Example:
        # Get default Gemini grader
        grader = get_grader()
        
        # Get Gemini grader with specific model
        grader = get_grader("gemini", "gemini-2.5-pro")
        
        # Future: Get OpenAI grader
        # grader = get_grader("openai", "gpt-4")
    """
    provider = provider.lower()
    
    if provider not in GRADER_PROVIDERS:
        available = ", ".join(GRADER_PROVIDERS.keys())
        raise ValueError(f"Unknown grader provider: {provider}. Available providers: {available}")
    
    # Create a cache key based on provider and model
    cache_key = f"{provider}:{model_name or 'default'}"
    
    if cache_key not in _grader_instances:
        grader_class = GRADER_PROVIDERS[provider]
        if model_name:
            _grader_instances[cache_key] = grader_class(model_name)
        else:
            _grader_instances[cache_key] = grader_class()
    
    return _grader_instances[cache_key]


def clear_grader_cache() -> None:
    """
    Clear the grader instance cache.
    
    Useful for testing or when you need to reset the grader instances.
    """
    global _grader_instances
    _grader_instances = {}


def list_available_providers() -> list:
    """
    Get a list of available grader providers.
    
    Returns:
        List of provider names that can be used with get_grader()
    """
    return list(GRADER_PROVIDERS.keys())
