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
        
    - expected_length: int = 1 # minutes, defualt 1 in length, convert to word count?




    







"""