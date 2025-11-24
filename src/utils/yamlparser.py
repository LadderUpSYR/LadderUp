# python parser for yaml files


# the structure of the each question metadata is as follows:


"""
question_metadata:
    - user_history:
        needs_work_history: optional[bool] = False
        consider_nth_previous: optional[int] = 0
    - question_difficulty: optional[str] = "medium"
    - grade_settings:
        - grammar_harhness: float = 0.5 # sliding scale of how harshly to grade on grammar
        - umms_penalty: float = 0.2 # penalty for using filler words like "um", "uh", etc.
        - repetition_penalty: float = 0.3 # penalty for repeating words or phrases
        - evident_examples: float = 1 # settings to see if examples match work history -- failure to do this will dramatically reduce score
        - star_adjustment: float = 0.1 # bonus for using STAR method, should match on difficulty
    - industry: optional[str] = "general"
    - role: optional[str] = "general"
    - expected_length: int = 1 # minutes, defualt 1 in length, convert to word count?
    - keywords: list[str] = [] # list of keywords to look for in answer
    - keyword_weights: dict[str, float] = {} # weights for each keyword
"""

import yaml
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


GLOBAL_GRAMMAR_HARSHNESS = 0.5
GLOBAL_UMMS_PENALTY = 0.2
GLOBAL_REPETITION_PENALTY = 0.3
GLOBAL_SPOKEN_WORDS_PER_MINUTE = 130  # average spoken words per minute?

GLOBAL_PREPROMPT: str = """

{{if needs_work_history}}
For this question, please consider the player's resume and work experience history to grade their answer appropriately. \
For this question, consider up to the {{consider_nth_previous}} most recent previous work experiences when grading.

Their work history is as follows:
{{pulled_work_history}}

For this question, if the player's answer does not align with their work history, please deduct points accordingly. \
The factor for this is {{evident_examples}}. For values closer to 1, deduct more points for misalignment.
{{end if}}


The expected length of the answer is {{expected_length}} minutes. The user's approximate time was {{calculated_length}} minutes.
There is a grace tolerance of 1 minute over and under the expected length, those answers should not be considered going over.


{{if keywords}}

The following keywords should be included in the answer: {{keywords}}.
Each keyword has the following weights: {{keyword_weights}}.
{{end if}}

The difficulty of this question is set to {{question_difficulty}}. Here is a breakdown of each difficulty level:
- Easy: Basic understanding of the topic, simple and straightforward answers. The answer can be more casual and brief, and does not need to show an in-depth knowledge of the subject matter.
- Medium: Moderate understanding of the topic, requires some depth and detail in the answer. The answer should be well-structured and demonstrate a good grasp of the subject matter.
- Hard: Advanced understanding of the topic, requires comprehensive and detailed answers. The answer should be thorough, well-reasoned, and demonstrate a deep knowledge of the subject matter.
When grading, please adjust your expectations based on the difficulty level of the question.

Here is the following brief description of the question's industry and role:
Industry: {{industry}}
Role: {{role}}

Finally, grade the answer with the following "bonus" and "penalty" settings:
- Grammar Harshness: {{grammar_harshness}} (scale from 0 to 1, where 1 is the most harsh)
- Umms Penalty: {{umms_penalty}} (scale from 0 to 1, where 1 is the most harsh)
- Repetition Penalty: {{repetition_penalty}} (scale from 0 to 1, where 1 is the most harsh)
- STAR Adjustment: {{star_adjustment}} (scale from 0 to 1, where 1 is the most harsh)


"""

# yaml parser will inject metadata into a fstring that will be passed along to the LLM grader
# assumses a Question Class with a metadata_yaml field like this:
# class Question:
#     def __init__(self, metadata_yaml: str):
#         self.metadata_yaml = metadata_yaml

@dataclass
class Question:
    id: int
    question: str
    answer_criteria: str
    passing_score: float
    avg_score: float = 1.0
    num_attempts: int = 0
    metadata_yaml: str = None

    @property
    def text(self) -> str:
        """Alias for question field to match common usage"""
        return self.question


def yaml_parser(question: Question, answer: str, player_uuid: str) -> str:
    """
    Parses the YAML metadata for a given question and returns it as a formatted string.

    Args:
        question (Question): The question object containing metadata.
        player_uuid (str): The unique identifier for the player.

    Returns:
        str: A formatted string containing the question metadata.
    """
    # Load the YAML metadata from the question
    metadata_yaml = question.metadata_yaml
    metadata = yaml.safe_load(metadata_yaml)

    # Extract relevant fields with defaults
    user_history = metadata.get("user_history", {})
    needs_work_history = user_history.get("needs_work_history", False)
    consider_nth_previous = user_history.get("consider_nth_previous", 0)

    # get the nth previous from the player's resume, this is a placeholder for actual implementation
    # pulled_work_history = get_player_work_history(player_uuid, consider_nth_previous)
    pulled_work_history = "Placeholder for player's work history."  # Placeholder text

    question_difficulty = metadata.get("question_difficulty", "medium")

    grade_settings = metadata.get("grade_settings", {})
    grammar_harshness = grade_settings.get("grammar_harshness", GLOBAL_GRAMMAR_HARSHNESS)
    umms_penalty = grade_settings.get("umms_penalty", GLOBAL_UMMS_PENALTY)
    repetition_penalty = grade_settings.get("repetition_penalty", GLOBAL_REPETITION_PENALTY)
    evident_examples = grade_settings.get("evident_examples", 1)
    star_adjustment = grade_settings.get("star_adjustment", 0.1)

    industry = metadata.get("industry", "general")
    role = metadata.get("role", "general")
    expected_length = metadata.get("expected_length", 1)
    keywords = metadata.get("keywords", [])
    keyword_weights = metadata.get("keyword_weights", {})

    # Calculate the approximate length of the answer in minutes
    word_count = len(answer.split())
    calculated_length = word_count / GLOBAL_SPOKEN_WORDS_PER_MINUTE


    # insert the variables into the preprompt
    preprompt = GLOBAL_PREPROMPT.format(
        needs_work_history=needs_work_history,
        consider_nth_previous=consider_nth_previous,
        question_difficulty=question_difficulty,
        grammar_harshness=grammar_harshness,
        umms_penalty=umms_penalty,
        repetition_penalty=repetition_penalty,
        evident_examples=evident_examples,
        star_adjustment=star_adjustment,
        industry=industry,
        role=role,
        expected_length=expected_length,
        keywords=keywords,
        keyword_weights=keyword_weights,
        calculated_length=calculated_length,
        pulled_work_history=pulled_work_history
    )

    return preprompt # this prompt can then be sent to the llm grader