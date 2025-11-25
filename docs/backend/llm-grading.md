# LLM Grading System Documentation

Documentation for `src/server_comps/llm_grading.py` - AI-powered interview answer grading using Google Gemini.

## Overview

The LLM grading system evaluates interview answers using Google's Gemini AI model. It provides:
- Numerical scores (0-100)
- Detailed feedback
- Specific strengths identification
- Actionable improvement suggestions
- Security validation against prompt injection

## Architecture

```
Answer Input → Validation → Prompt Building → Gemini API → 
Output Sanitization → Structured Response
```

## Dependencies

```python
import google.generativeai as genai
from src.utils.yamlparser import yaml_parser, Question
```

## Configuration

### Environment Variables

```python
GEMINI_API_KEY=your_gemini_api_key
```

Must be set in environment or `.env` file.

### Model Selection

Default: `gemini-2.5-flash` (fast, cost-effective)
Alternative: `gemini-2.5-pro` (more detailed analysis, slower, more expensive)

## InterviewGrader Class

### Initialization

```python
grader = InterviewGrader(model_name="gemini-2.5-flash")
```

**Parameters:**
- `model_name` (str): Gemini model to use

**Available Models:**
- `gemini-2.5-flash`: Fast, optimized for quick responses
- `gemini-2.5-pro`: More thorough analysis

**Raises:**
- `ValueError`: If GEMINI_API_KEY not found

### Security Constants

```python
MAX_INPUT_LENGTH = 10000  # Maximum characters
```

**Suspicious Patterns Detected:**
- "ignore previous instructions"
- "ignore all previous"
- "disregard"
- "you are now"
- "new role"
- "system:"
- "admin:"
- "override"
- "forget everything"
- "act as"
- "pretend you are"
- "simulate"
- "jailbreak"
- "DAN mode"
- "developer mode"

These patterns are logged but not blocked - the prompt design handles them safely.

## Key Methods

### grade_answer()

Main method for grading interview responses.

```python
def grade_answer(
    self,
    question: Question,
    answer: str,
    player_uuid: Optional[str] = None,
    video_analytics: Optional[Dict] = None
) -> Dict
```

**Parameters:**
- `question` (Question): Question object with text and criteria
- `answer` (str): User's answer text
- `player_uuid` (str, optional): Player identifier for logging
- `video_analytics` (dict, optional): Video metrics from practice mode

**Returns:**
```python
{
    "score": float,  # 0-100
    "feedback": str,  # Overall feedback paragraph
    "strengths": List[str],  # 2-4 specific strengths
    "improvements": List[str],  # 2-4 specific improvements
    "raw_response": str  # Full LLM response
}
```

**Process Flow:**

1. **Input Validation**
   ```python
   question_text = self._validate_input(question.question, "question")
   answer_text = self._validate_input(answer, "answer")
   ```
   - Checks for empty strings
   - Enforces length limits
   - Detects suspicious patterns

2. **Prompt Building**
   ```python
   prompt = self._build_grading_prompt(
       question_text, 
       answer_text, 
       question.answer_criteria,
       video_analytics
   )
   ```

3. **API Call**
   ```python
   response = self.model.generate_content(prompt)
   ```

4. **Response Parsing**
   - Extracts score from text
   - Parses feedback sections
   - Identifies strengths/improvements

5. **Output Sanitization**
   ```python
   result = self._sanitize_output(result)
   ```
   - Checks for leaked system prompts
   - Validates score range
   - Ensures all fields present

**Example Usage:**

```python
from src.server_comps.llm_grading import get_grader
from src.utils.yamlparser import Question

grader = get_grader()

question = Question(
    id=1,
    question="Tell me about a time you showed leadership.",
    answer_criteria="Should follow STAR method",
    passing_score=70.0,
    metadata_yaml=None
)

result = grader.grade_answer(
    question=question,
    answer="In my previous role, I led a team of 5 engineers...",
    video_analytics={
        "avgConfidence": 0.85,
        "eyeContactPercentage": 75
    }
)

print(f"Score: {result['score']}")
print(f"Feedback: {result['feedback']}")
```

### _validate_input()

Validates and sanitizes user input.

```python
def _validate_input(self, text: str, field_name: str) -> str
```

**Parameters:**
- `text`: Input to validate
- `field_name`: Name for error messages

**Returns:**
- Stripped, validated text

**Raises:**
- `ValueError`: If empty or too long

**Security Checks:**
- Length validation (max 10,000 chars)
- Suspicious pattern detection
- Whitespace trimming

**Logging:**
- Logs suspicious patterns for monitoring
- Does NOT block (prompt handles safely)

### _build_grading_prompt()

Constructs the prompt sent to Gemini.

```python
def _build_grading_prompt(
    self,
    question: str,
    answer: str,
    criteria: Optional[str],
    video_analytics: Optional[Dict] = None
) -> str
```

**Prompt Structure:**

```
You are an expert interview coach evaluating answers to behavioral interview questions.

[CONTEXT SECTION]
- Question being asked
- Answer provided by candidate
- Grading criteria (if provided)
- Video analytics (if available)

[EVALUATION CRITERIA]
1. Content quality and relevance
2. Structure and clarity
3. Specific examples
4. Communication effectiveness
5. Completeness

[VIDEO METRICS INTEGRATION]
If video_analytics provided:
- Average confidence score
- Eye contact percentage
- Expression analysis

[OUTPUT FORMAT]
Score: [0-100]

Feedback:
[2-3 paragraph overall assessment]

Strengths:
- [Specific strength 1]
- [Specific strength 2]
- [Additional strengths]

Areas for Improvement:
- [Specific improvement 1]
- [Specific improvement 2]
- [Additional improvements]
```

**Video Analytics Integration:**

When `video_analytics` provided:
```python
{
    "avgConfidence": 0.85,  # Face detection confidence
    "eyeContactPercentage": 75,  # Eye contact %
    "neutralExpressionPercentage": 60  # Neutral expression %
}
```

The prompt instructs Gemini to:
- Consider non-verbal communication
- Factor in eye contact
- Evaluate confidence level
- Provide feedback on presence

### _sanitize_output()

Sanitizes LLM output for security.

```python
def _sanitize_output(self, result: Dict) -> Dict
```

**Security Checks:**

1. **Leaked System Prompts**
   - Detects if LLM included instructions
   - Checks for "you are an expert"
   - Checks for "evaluate this answer"

2. **Safe Defaults**
   If leak detected:
   ```python
   return {
       "score": 50.0,
       "feedback": "Unable to generate feedback...",
       "strengths": ["Answer provided"],
       "improvements": ["Please try again"]
   }
   ```

3. **Score Validation**
   ```python
   score = max(0.0, min(100.0, score))  # Clamp 0-100
   ```

4. **Required Fields**
   Ensures presence of:
   - `score`
   - `feedback`
   - `strengths`
   - `improvements`

**Returns:**
- Sanitized result dictionary

## Helper Functions

### get_grader()

Factory function for getting grader instance.

```python
def get_grader(model_name: str = "gemini-2.5-flash") -> InterviewGrader:
    return InterviewGrader(model_name)
```

**Usage:**
```python
from src.server_comps.llm_grading import get_grader

grader = get_grader()
# or
grader = get_grader("gemini-2.5-pro")
```

## Response Parsing

The grader parses LLM text responses into structured data:

### Score Extraction

```python
# Looks for patterns like:
# "Score: 85"
# "Score: 85/100"
# "85/100"
```

### Section Parsing

- **Feedback**: Text between "Feedback:" and "Strengths:"
- **Strengths**: Bulleted list after "Strengths:"
- **Improvements**: Bulleted list after "Areas for Improvement:"

### Fallback Behavior

If parsing fails:
```python
{
    "score": 50.0,
    "feedback": raw_response,
    "strengths": ["See feedback above"],
    "improvements": ["See feedback above"]
}
```

## Error Handling

### API Errors

```python
try:
    response = self.model.generate_content(prompt)
except Exception as e:
    # Log error
    # Return safe default response
    return {
        "score": 0.0,
        "feedback": "Error generating grade",
        "strengths": [],
        "improvements": []
    }
```

### Validation Errors

```python
raise ValueError("Question cannot be empty")
raise ValueError("Answer exceeds maximum length of 10000 characters")
```

### Parse Errors

Graceful degradation - returns raw response in feedback.

## Security Features

### 1. Input Validation

- Length limits prevent token overflow
- Pattern detection identifies injection attempts
- Logging for security monitoring

### 2. Prompt Design

The prompt explicitly:
- Defines role boundaries
- Specifies output format
- Prevents instruction override

### 3. Output Sanitization

- Detects leaked system instructions
- Validates score ranges
- Ensures required fields

### 4. Rate Limiting

**Not Implemented** - Consider adding:
- Per-user API call limits
- Cost tracking
- Timeout handling

## Performance Considerations

### Response Time

- **gemini-2.5-flash**: ~1-3 seconds
- **gemini-2.5-pro**: ~3-5 seconds

### Cost Optimization

- Use flash model for most requests
- Pro model for detailed analysis only
- Consider caching for identical Q&A pairs

### Token Usage

- Input: ~500-1000 tokens (question + answer + prompt)
- Output: ~200-400 tokens (score + feedback)
- Total: ~700-1400 tokens per request

## Integration Example

From `server.py`:

```python
from src.server_comps.llm_grading import get_grader
from src.utils.yamlparser import Question

# In submit_answer endpoint
grader = get_grader()

question_obj = Question(
    id=0,
    question=data.question,
    answer_criteria=data.answerCriteria,
    passing_score=0.0,
    metadata_yaml=None
)

grading_result = grader.grade_answer(
    question=question_obj,
    answer=data.answer,
    player_uuid=None,
    video_analytics=data.videoAnalytics
)

# Use grading_result to create answer record
answer_record = {
    "score": grading_result["score"],
    "feedback": grading_result["feedback"],
    "strengths": grading_result["strengths"],
    "improvements": grading_result["improvements"],
    # ... other fields
}
```

## Testing

### Unit Tests

```bash
pytest unittests/test_llm_grading.py
```

### Mock Responses

For testing without API calls:
```python
from unittest.mock import Mock

grader.model.generate_content = Mock(return_value=Mock(
    text="Score: 85\n\nFeedback: Great answer...\n\n"
         "Strengths:\n- Clear structure\n\n"
         "Areas for Improvement:\n- Add more detail"
))
```

## Future Enhancements

1. **Response Caching**: Cache identical question-answer pairs
2. **Batch Processing**: Grade multiple answers in one call
3. **Custom Models**: Fine-tuned models for interview domain
4. **Structured Output**: Use Gemini's structured output mode
5. **Multi-language**: Support non-English answers
6. **Rubric Support**: Detailed rubric-based grading
7. **Comparison**: Compare to reference answers
8. **Progress Tracking**: Track improvement over time

## Monitoring

### Metrics to Track

- API call count
- Response times
- Error rates
- Token usage
- Cost per request
- Score distributions
- Suspicious pattern detections

### Logging

Current: Print statements
Recommended: Structured logging

```python
import logging

logger = logging.getLogger(__name__)
logger.warning(f"Suspicious pattern detected: {pattern}")
logger.error(f"Grading failed: {e}")
```

## Related Documentation

- [Server API](./server-api.md)
- [Question Management](../database-schema.md)
- [Testing Guide](../testing.md)
