"""
Match Room System for 1v1 Interview Practice
Handles room creation, player authentication, timed questions, video streaming, and STT
"""

import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Set, Optional, List
import redis.asyncio as redis
from quart import Blueprint, websocket, request, jsonify
from dataclasses import dataclass, asdict
from enum import Enum
import random
import numpy as np
from faster_whisper import WhisperModel

# Initialize Redis client
redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)

# Lazy initialization for Whisper model
_whisper_model = None

def get_whisper_model():
    """Lazy initialization of Whisper model for speech-to-text"""
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = WhisperModel("base", device="cpu")
    return _whisper_model

# Constants
ROOM_PREFIX = "room:"
ROOM_TTL_SECONDS = 600  # 10 min
ACTIVE_ROOMS_SET = "active_rooms"
MATCH_DURATION_SECONDS = 20  # 7 minutes (420 seconds) for the match
AUDIO_RATE = 16000  # 16kHz sample rate
CHUNK_DURATION = 4  # Process audio every 1 seconds

match_room_bp = Blueprint("match_room", __name__)


class RoomStatus(Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


@dataclass
class MatchRoom:
    """Data model for a match room"""
    match_id: str
    player1_uid: str
    player2_uid: str
    created_at: str
    status: str
    question_id: Optional[int] = None
    question_text: Optional[str] = None  
    player1_ready: bool = False
    player2_ready: bool = False
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    time_remaining: Optional[int] = None  


# In-memory tracking of active WebSocket connections
# Key: match_id, Value: {player_uid: websocket_connection}
active_connections: Dict[str, Dict[str, any]] = {}

# Audio buffers for each player (for continuous transcription)
# Key: f"{match_id}:{player_uid}", Value: list of audio chunks
audio_buffers: Dict[str, list] = {}

player_answers: Dict[str, List[str]] = {}

# Active timers for match countdown
active_timers: Dict[str, asyncio.Task] = {}


async def get_random_question_from_firestore():
    """
    Fetch a random question from Firestore
    This should be called when both players are ready
    """
    from .server import db  
    
    try:
        questions_ref = db.collection("questions")
        all_questions = list(questions_ref.stream())
        
        if not all_questions:
            return {
                "id": 1,
                "question": "Tell us about a time you had a great team member. How did they make the project better?",
                "answerCriteria": "This question should follow the STAR principle. They can answer in many ways, but should be short (maximum of one minute or ten sentences)."
            }
        
        # Select random question
        random_doc = random.choice(all_questions)
        question_data = random_doc.to_dict()
        
        question_id = random_doc.id
        
        return {
            "id": question_id,
            "question": question_data.get("question", ""),
            "answerCriteria": question_data.get("answerCriteria", "")
        }
        
    except Exception as e:
        print(f"Error fetching question from Firestore: {e}")
        # Return default question on error
        return {
            "id": 1,
            "question": "Tell us about a time you overcame a challenge at work.",
            "answerCriteria": "Use the STAR method to structure your answer."
        }


async def start_match_timer_with_grading(match_id: str):
    """
    Match timer that triggers answer grading when time expires
    """
    room_key = f"{ROOM_PREFIX}{match_id}"
    time_remaining = MATCH_DURATION_SECONDS
    grading_completed = False
    
    try:
        while time_remaining > 0:
            # Update time remaining in Redis
            await redis_client.hset(room_key, "time_remaining", str(time_remaining))
            
            # Broadcast time update
            await broadcast_to_room(match_id, {
                "type": "time_update",
                "time_remaining": time_remaining,
                "minutes": time_remaining // 60,
                "seconds": time_remaining % 60
            })
            
            # Warning messages at specific intervals
            if time_remaining == 60:
                await broadcast_to_room(match_id, {
                    "type": "time_warning",
                    "message": "1 minute remaining!",
                    "time_remaining": 60
                })
            elif time_remaining == 30:
                await broadcast_to_room(match_id, {
                    "type": "time_warning", 
                    "message": "30 seconds remaining!",
                    "time_remaining": 30
                })
            elif time_remaining == 10:
                await broadcast_to_room(match_id, {
                    "type": "time_warning",
                    "message": "10 seconds! Wrap up your answer!",
                    "time_remaining": 10
                })
            
            # Determine wait time based on remaining time
            if time_remaining <= 10:
                wait_time = 1  # Update every second in last 10 seconds
            elif time_remaining <= 30:
                wait_time = 5  # Update every 5 seconds from 30 to 10
            else:
                wait_time = 10  # Update every 10 seconds otherwise
            
            # Don't wait longer than remaining time
            wait_time = min(wait_time, time_remaining)
            
            await asyncio.sleep(wait_time)
            time_remaining -= wait_time
        
        # Time's up! Only grade once
        if not grading_completed:
            print(f"Timer expired for match {match_id}, starting grading...")
            
            # Notify players that grading is starting
            await broadcast_to_room(match_id, {
                "type": "match_ending",
                "message": "Time's up! Grading your answers..."
            })
            
            # Grade the answers
            await save_match_answers(match_id)
            grading_completed = True
            print(f"Grading completed for match {match_id}")
        
        # Update room status to completed
        await update_room_status(match_id, RoomStatus.COMPLETED)
        print(f"Match {match_id} completed via timer expiration")
        
    except asyncio.CancelledError:
        # Timer was cancelled (e.g., manual completion or disconnection)
        print(f"Timer cancelled for match {match_id}")
        
        # Only grade if not already done
        if not grading_completed:
            print(f"Starting grading for cancelled match {match_id}...")
            
            # Notify players
            await broadcast_to_room(match_id, {
                "type": "match_ending",
                "message": "Match ended. Grading your answers..."
            })
            
            # Grade the answers
            await save_match_answers(match_id)
            grading_completed = True
            print(f"Grading completed for cancelled match {match_id}")
        else:
            print(f"Grading already completed for match {match_id}, skipping")
        
        # Update room status
        await update_room_status(match_id, RoomStatus.COMPLETED)
        raise  # Re-raise the CancelledError to properly handle the cancellation
        
    except Exception as e:
        # Unexpected error
        print(f"Unexpected error in timer for match {match_id}: {e}")
        
        # Try to save answers if possible
        if not grading_completed:
            try:
                await save_match_answers(match_id)
                grading_completed = True
            except Exception as save_error:
                print(f"Failed to save answers after error: {save_error}")
        
        # Update status to completed or abandoned
        await update_room_status(match_id, RoomStatus.COMPLETED)
        raise
        
    finally:
        # Clean up timer reference
        if match_id in active_timers:
            del active_timers[match_id]
            print(f"Cleaned up timer reference for match {match_id}")


async def cancel_match_timer(match_id: str):
    """Cancel the timer for a match (e.g., if manually completed)"""
    if match_id in active_timers:
        active_timers[match_id].cancel()
        try:
            await active_timers[match_id]
        except asyncio.CancelledError:
            pass


async def create_match_room(match_id: str, player1_uid: str, player2_uid: str) -> MatchRoom:
    """
    Create a new match room in Redis
    
    Args:
        match_id: Unique identifier for the match
        player1_uid: First player's user ID
        player2_uid: Second player's user ID
    
    Returns:
        MatchRoom object with room details
    """
    room = MatchRoom(
        match_id=match_id,
        player1_uid=player1_uid,
        player2_uid=player2_uid,
        created_at=datetime.now(timezone.utc).isoformat(),
        status=RoomStatus.WAITING.value
    )
    
    room_key = f"{ROOM_PREFIX}{match_id}"
    
    # Store room data in Redis hash (filter out None values and convert bools to strings)
    room_dict = {}
    for k, v in asdict(room).items():
        if v is not None:
            # Convert boolean to string for Redis
            if isinstance(v, bool):
                room_dict[k] = str(v)
            else:
                room_dict[k] = v
    await redis_client.hset(room_key, mapping=room_dict)
    await redis_client.expire(room_key, ROOM_TTL_SECONDS)
    
    # Add to active rooms set
    await redis_client.sadd(ACTIVE_ROOMS_SET, match_id)
    

    return room


async def get_match_room(match_id: str) -> Optional[Dict]:
    """Retrieve match room data from Redis"""
    room_key = f"{ROOM_PREFIX}{match_id}"
    room_data = await redis_client.hgetall(room_key)
    
    if not room_data:
        return None
    
    # Convert string booleans back to actual booleans
    if 'player1_ready' in room_data:
        room_data['player1_ready'] = room_data['player1_ready'].lower() == 'true'
    if 'player2_ready' in room_data:
        room_data['player2_ready'] = room_data['player2_ready'].lower() == 'true'
    
    # Convert time_remaining to int if present
    if 'time_remaining' in room_data and room_data['time_remaining']:
        room_data['time_remaining'] = int(room_data['time_remaining'])
    
    return room_data


async def update_room_status(match_id: str, status: RoomStatus):
    """Update the status of a match room"""
    room_key = f"{ROOM_PREFIX}{match_id}"
    await redis_client.hset(room_key, "status", status.value)
    
    if status == RoomStatus.ACTIVE:
        await redis_client.hset(room_key, "started_at", datetime.now(timezone.utc).isoformat())
    elif status in [RoomStatus.COMPLETED, RoomStatus.ABANDONED]:
        await redis_client.hset(room_key, "completed_at", datetime.now(timezone.utc).isoformat())
        # Remove from active rooms
        await redis_client.srem(ACTIVE_ROOMS_SET, match_id)
        
        await cancel_match_timer(match_id)


async def set_player_ready(match_id: str, player_uid: str) -> Dict:
    """
    Mark a player as ready in the room
    When both players are ready:
    1. Select a random question
    2. Store it in the room
    3. Start the match timer
    4. Return the question to both players
    
    Returns dict with: {"both_ready": bool, "question": dict or None}
    """
    room_data = await get_match_room(match_id)
    if not room_data:
        return {"both_ready": False, "question": None}
    
    room_key = f"{ROOM_PREFIX}{match_id}"
    
    # Determine which player is ready
    if player_uid == room_data['player1_uid']:
        await redis_client.hset(room_key, "player1_ready", "true")
        room_data['player1_ready'] = True
    elif player_uid == room_data['player2_uid']:
        await redis_client.hset(room_key, "player2_ready", "true")
        room_data['player2_ready'] = True
    
    # Check if both players are ready
    both_ready = room_data.get('player1_ready') and room_data.get('player2_ready')
    
    if both_ready: # setup the game
        question = await get_random_question_from_firestore()
        
        # Store question in room
        await redis_client.hset(room_key, "question_id", str(question["id"]))
        await redis_client.hset(room_key, "question_text", question["question"])
        
        # Update room status to ACTIVE
        await update_room_status(match_id, RoomStatus.ACTIVE)
        
        # Start the match timer
        timer_task = asyncio.create_task(start_match_timer(match_id))
        active_timers[match_id] = timer_task
        
        return {
            "both_ready": True,
            "question": question
        }
    
    return {"both_ready": False, "question": None}


async def verify_player_access(match_id: str, player_uid: str) -> bool:
    """
    Verify that a player has access to this match room
    """
    room_data = await get_match_room(match_id)
    if not room_data:
        return False
    
    return player_uid in [room_data['player1_uid'], room_data['player2_uid']]


async def broadcast_to_room(match_id: str, message: dict, exclude_player: Optional[str] = None):
    """
    Send a message to all connected players in a room
    
    Args:
        match_id: The room to broadcast to
        message: The message dictionary to send
        exclude_player: Optional player_uid to exclude from broadcast
    """
    # Check if room has any active connections
    if match_id not in active_connections:
        print(f"DEBUG: Room {match_id} not in active_connections")
        return
    
    if not active_connections[match_id]:
        print(f"DEBUG: Room {match_id} has no players")
        return
    
    print(f"DEBUG: Broadcasting to room {match_id}")
    print(f"DEBUG: Players in room: {list(active_connections[match_id].keys())}")
    print(f"DEBUG: Excluding player: {exclude_player}")
    print(f"DEBUG: Message type: {message.get('type')}")
    
    message_json = json.dumps(message)
    
    for player_uid, ws in list(active_connections[match_id].items()):
        if exclude_player and player_uid == exclude_player:
            print(f"DEBUG: Skipping excluded player {player_uid}")
            continue
        
        print(f"DEBUG: Attempting to send to player {player_uid}")
        try:
            await ws.send(message_json)
            print(f"DEBUG: Successfully sent to player {player_uid}")
        except Exception as e:
            print(f"ERROR: Failed to send to player {player_uid}: {e}")
            import traceback
            traceback.print_exc()

async def accumulate_transcription(match_id: str, player_uid: str, text: str):
    """
    Accumulate transcription segments for a player during the match
    
    Args:
        match_id: The room ID
        player_uid: The player who spoke
        text: The transcribed text segment
    """
    key = f"{match_id}:{player_uid}"
    
    if key not in player_answers:
        player_answers[key] = []
    
    player_answers[key].append(text)
    
    # Log for debugging
    total_words = sum(len(seg.split()) for seg in player_answers[key])
    print(f"[{match_id}] {player_uid}: Accumulated {total_words} words")


async def save_match_answers(match_id: str):
    """
    Called when match ends - compile, save, and grade all answers
    
    Args:
        match_id: The match room ID
    """
    print(f"Starting end-of-match grading for match {match_id}")
    
    # Get room data
    room_data = await get_match_room(match_id)
    if not room_data:
        print(f"No room data found for match {match_id}")
        return
    
    question_id = room_data.get('question_id')
    if not question_id:
        print(f"No question ID found for match {match_id}")
        return
    
    # Import the answer service
    from .answer_to_db_middleware import answer_to_db_middleware
    
    # Process both players
    players = [room_data['player1_uid'], room_data['player2_uid']]
    grading_results = {}
    
    for player_uid in players:
        key = f"{match_id}:{player_uid}"
        
        # Check if player has any transcriptions
        if key not in player_answers or not player_answers[key]:
            print(f"No answer found for player {player_uid}")
            grading_results[player_uid] = {
                "status": "no_answer",
                "message": "No answer recorded"
            }
            continue
        
        # Compile the complete answer
        answer_segments = player_answers[key]
        complete_answer = " ".join(answer_segments)
        
        # Clean up extra spaces
        complete_answer = " ".join(complete_answer.split())
        
        word_count = len(complete_answer.split())
        print(f"Player {player_uid} answer: {word_count} words")
        
        try:
            # Grade and save the answer
            result = await answer_to_db_middleware(
                answer=complete_answer,
                question_id=question_id,
                player_uuid=player_uid
            )
            
            grading_results[player_uid] = {
                "status": "success",
                "score": result['score'],
                "feedback": result.get('feedback', ''),
                "strengths": result.get('strengths', []),
                "improvements": result.get('improvements', []),
                "word_count": word_count
            }
            
            print(f"Successfully graded answer for {player_uid}: Score {result['score']}/10")
            
        except Exception as e:
            print(f"Error grading answer for {player_uid}: {e}")
            grading_results[player_uid] = {
                "status": "error",
                "message": f"Grading failed: {str(e)}",
                "word_count": word_count
            }
    
    # Send grading results to all players
    await broadcast_to_room(match_id, {
        "type": "match_graded",
        "results": grading_results,
        "message": "Match completed and answers graded!"
    })
    
    # Clean up answer buffers
    for player_uid in players:
        key = f"{match_id}:{player_uid}"
        if key in player_answers:
            del player_answers[key]
    
    print(f"Completed grading for match {match_id}")



# ==================== MODIFIED AUDIO PROCESSING ====================

async def process_audio_chunk_with_accumulation(match_id: str, player_uid: str, audio_chunk: bytes):
    """
    Process audio chunks and accumulate transcriptions for end-of-match grading
    """
    buffer_key = f"{match_id}:{player_uid}"
    
    # Initialize buffer if needed
    if buffer_key not in audio_buffers:
        audio_buffers[buffer_key] = []
    
    # Add chunk to buffer
    audio_buffers[buffer_key].append(audio_chunk)
    
    # Calculate buffer duration
    total_samples = sum(len(chunk) // 2 for chunk in audio_buffers[buffer_key])
    duration = total_samples / AUDIO_RATE
    
    # Process when buffer reaches threshold
    if duration >= CHUNK_DURATION:
        try:
            # Convert to numpy array
            audio_data = b''.join(audio_buffers[buffer_key])
            audio_np = np.frombuffer(audio_data, dtype=np.int16)
            audio_float = audio_np.astype(np.float32) / 32768.0
            
            # Transcribe with Whisper
            whisper = get_whisper_model()
            segments, info = whisper.transcribe(audio_float, language="en")
            
            # Collect transcribed text
            transcription_text = ""
            for segment in segments:
                text = segment.text.strip()
                if text:
                    transcription_text += text + " "
            
            # Process non-empty transcriptions
            if transcription_text.strip():
                # Accumulate for end-of-match grading
                await accumulate_transcription(
                    match_id,
                    player_uid,
                    transcription_text.strip()
                )
                
                # Broadcast for real-time display (without saving)
                await broadcast_to_room(match_id, {
                    "type": "transcription",
                    "player": player_uid,
                    "text": transcription_text.strip(),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            
            # Keep last 0.5s for context overlap
            overlap_samples = int(AUDIO_RATE * 0.5)
            overlap_bytes = overlap_samples * 2
            audio_buffers[buffer_key] = [audio_data[-overlap_bytes:]]
            
        except Exception as e:
            print(f"Error processing audio for {player_uid}: {e}")
            audio_buffers[buffer_key] = []


process_audio_chunk = process_audio_chunk_with_accumulation

# 2. Replace your existing start_match_timer with:
start_match_timer = start_match_timer_with_grading


# ==================== HTTP ENDPOINTS ====================

@match_room_bp.route("/api/match/<match_id>/info", methods=["GET"])
async def get_room_info(match_id: str):
    """Get information about a match room"""
    from .server import get_session, SESSION_COOKIE_NAME
    
    # Authenticate user
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return jsonify({"error": "Not authenticated"}), 401
    
    session_data = await get_session(session_token)
    if not session_data:
        return jsonify({"error": "Invalid session"}), 401
    
    player_uid = session_data["uid"]
    
    # Get room data
    room_data = await get_match_room(match_id)
    if not room_data:
        return jsonify({"error": "Room not found"}), 404
    
    # Verify player access
    if not await verify_player_access(match_id, player_uid):
        return jsonify({"error": "Access denied"}), 403
    
    # Determine opponent
    opponent_uid = (room_data['player2_uid'] if player_uid == room_data['player1_uid'] 
                    else room_data['player1_uid'])
    
    response_data = {
        "match_id": match_id,
        "status": room_data['status'],
        "player_uid": player_uid,
        "opponent_uid": opponent_uid,
        "created_at": room_data['created_at'],
        "is_ready": (room_data.get('player1_ready') if player_uid == room_data['player1_uid'] 
                     else room_data.get('player2_ready')),
        "time_remaining": room_data.get('time_remaining')
    }
    
    if room_data.get('question_text'):
        response_data["question"] = {
            "id": room_data.get('question_id'),
            "text": room_data.get('question_text')
        }
    
    return jsonify(response_data)

@match_room_bp.route("/api/match/<match_id>/force_complete", methods=["POST"])
async def force_complete_match(match_id: str):
    """
    Manually complete a match and trigger grading
    Used for testing or admin purposes
    """
    from .server import get_session, SESSION_COOKIE_NAME
    
    # Authenticate user
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return jsonify({"error": "Not authenticated"}), 401
    
    session_data = await get_session(session_token)
    if not session_data:
        return jsonify({"error": "Invalid session"}), 401
    
    player_uid = session_data["uid"]
    
    # Verify access
    if not await verify_player_access(match_id, player_uid):
        return jsonify({"error": "Access denied"}), 403
    
    # Get room status
    room_data = await get_match_room(match_id)
    if room_data and room_data['status'] == RoomStatus.COMPLETED.value:
        return jsonify({"error": "Match already completed"}), 400
    
    # Notify players
    await broadcast_to_room(match_id, {
        "type": "match_ending",
        "message": "Match ended manually. Grading answers...",
        "ended_by": player_uid
    })
    
    # Cancel timer if running
    await cancel_match_timer(match_id)
    
    # This will trigger grading via the timer's except handler
    return jsonify({"success": True, "message": "Match completion initiated"})


@match_room_bp.route("/api/match/<match_id>/transcript", methods=["GET"])
async def get_current_transcript(match_id: str):
    """
    Get the current accumulated transcript for a player (for preview only)
    Does NOT trigger grading
    """
    from .server import get_session, SESSION_COOKIE_NAME
    
    # Authenticate user
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return jsonify({"error": "Not authenticated"}), 401
    
    session_data = await get_session(session_token)
    if not session_data:
        return jsonify({"error": "Invalid session"}), 401
    
    player_uid = session_data["uid"]
    
    # Verify access
    if not await verify_player_access(match_id, player_uid):
        return jsonify({"error": "Access denied"}), 403
    
    # Get current accumulated answer
    key = f"{match_id}:{player_uid}"
    if key not in player_answers:
        return jsonify({
            "transcript": "",
            "word_count": 0,
            "segment_count": 0
        })
    
    segments = player_answers[key]
    full_transcript = " ".join(segments)
    
    return jsonify({
        "transcript": full_transcript,
        "word_count": len(full_transcript.split()),
        "segment_count": len(segments)
    })


@match_room_bp.route("/api/match/<match_id>/ready", methods=["POST"])
async def mark_player_ready(match_id: str):
    """
    Returns the question if both players are ready
    """
    from .server import get_session, SESSION_COOKIE_NAME
    
    # Authenticate user
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return jsonify({"error": "Not authenticated"}), 401
    
    session_data = await get_session(session_token)
    if not session_data:
        return jsonify({"error": "Invalid session"}), 401
    
    player_uid = session_data["uid"]
    
    # Verify access
    if not await verify_player_access(match_id, player_uid):
        return jsonify({"error": "Access denied"}), 403
    
    result = await set_player_ready(match_id, player_uid)
    
    # Broadcast ready status to room
    broadcast_message = {
        "type": "player_ready",
        "player": player_uid,
        "both_ready": result["both_ready"]
    }
    
    if result["both_ready"] and result["question"]:
        broadcast_message["question"] = result["question"]
        broadcast_message["match_duration_seconds"] = MATCH_DURATION_SECONDS
    
    await broadcast_to_room(match_id, broadcast_message)
    
    return jsonify(result)


# ==================== WEBSOCKET ENDPOINT ====================

@match_room_bp.websocket("/ws/room/<match_id>")
async def room_websocket(match_id: str):
    """
    WebSocket endpoint for real-time communication in a match room
    Supports:
    - Audio stream chunks (for STT)
    - Player status updates
    - Room events
    - Timer updates
    """
    await websocket.accept()
    
    from .server import get_session, SESSION_COOKIE_NAME
    
    # Authenticate user
    token = websocket.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        await websocket.send(json.dumps({"error": "Not authenticated"}))
        await websocket.close(code=1008)
        return
    
    session_data = await get_session(token)
    if not session_data:
        await websocket.send(json.dumps({"error": "Invalid session"}))
        await websocket.close(code=1008)
        return
    
    player_uid = session_data["uid"]
    
    # Verify room access
    if not await verify_player_access(match_id, player_uid):
        await websocket.send(json.dumps({"error": "Access denied"}))
        await websocket.close(code=1008)
        return
    
    # Register connection
    if match_id not in active_connections:
        active_connections[match_id] = {}
    active_connections[match_id][player_uid] = websocket._get_current_object()
    
    # ========== AUTO-READY LOGIC ==========
    print(f"Auto-readying player {player_uid} in room {match_id}...")
    result = await set_player_ready(match_id, player_uid)
    print(f"Auto-ready result - Both ready: {result['both_ready']}, Question: {result.get('question')}")
    # ======================================
    
    # Notify room of player join
    await broadcast_to_room(match_id, {
        "type": "player_joined",
        "player": player_uid
    }, exclude_player=player_uid)
    
    # Get current room state
    room_data = await get_match_room(match_id)
    
    # Build connection message
    connection_message = {
        "type": "connected",
        "match_id": match_id,
        "player_uid": player_uid,
        "status": room_data.get('status') if room_data else 'waiting',
        "is_ready": True  # Player is auto-readied
    }
    
    # ========== CHECK IF BOTH PLAYERS READY ==========
    both_ready = result["both_ready"] and result.get("question")
    
    # If both players are ready, include question and mark as active
    if both_ready:
        print(f"Both players ready! Starting match in room {match_id}")
        connection_message["status"] = "active"
        connection_message["question"] = result["question"]
        connection_message["time_remaining"] = MATCH_DURATION_SECONDS
        connection_message["match_duration_seconds"] = MATCH_DURATION_SECONDS
    # If only this player is ready, check if question already exists from first player
    elif room_data and room_data.get('question_text'):
        connection_message["question"] = {
            "id": room_data.get('question_id'),
            "text": room_data.get('question_text')
        }
        connection_message["time_remaining"] = room_data.get('time_remaining')
    # =================================================
    
    print(f"Sending connection message: {json.dumps(connection_message, indent=2)}")
    await websocket.send(json.dumps(connection_message))
    
    # ========== BROADCAST AFTER CONNECTION MESSAGE ==========
    # Send match start notification to other player AFTER this player's connection is established
    if both_ready:
        print(f"Broadcasting match start to other players in room {match_id}...")
        await broadcast_to_room(match_id, {
            "type": "player_ready",
            "player": player_uid,
            "both_ready": True,
            "question": result["question"],
            "match_duration_seconds": MATCH_DURATION_SECONDS
        }, exclude_player=player_uid)
    # ========================================================
    
    try:
        while True:
            message = await websocket.receive()
            # Handle different message types
            try:
                if isinstance(message, bytes):
                    # Binary data (audio stream chunks for STT)
                    await process_audio_chunk(match_id, player_uid, message)
                else:
                    # JSON messages
                    data = json.loads(message)
                    await handle_room_message(match_id, player_uid, data)
            except json.JSONDecodeError:
                await websocket.send(json.dumps({"error": "Invalid message format"}))
            except Exception as e:
                print(f"Error handling message: {e}")
    
    except asyncio.CancelledError:
        print(f"Player {player_uid} disconnected from room {match_id}")
    finally:
        # Cleanup connection
        if match_id in active_connections and player_uid in active_connections[match_id]:
            del active_connections[match_id][player_uid]
            
            # If room is empty, clean up
            if not active_connections[match_id]:
                del active_connections[match_id]
        
        # Clean up audio buffer
        buffer_key = f"{match_id}:{player_uid}"
        if buffer_key in audio_buffers:
            del audio_buffers[buffer_key]
        
        # Notify room of player departure
        await broadcast_to_room(match_id, {
            "type": "player_left",
            "player": player_uid
        })

async def handle_room_message(match_id: str, player_uid: str, data: dict):
    """
    Handle JSON messages from players in the match room
    
    Supported message types:
    - ready: Player marks themselves as ready
    - chat: Send a chat message to the room
    - signal: WebRTC signaling data
    - start_audio: Player started speaking
    - stop_audio: Player stopped speaking
    
    Args:
        match_id: The room ID
        player_uid: The player sending the message
        data: The message data dict
    """
    message_type = data.get("type")
    
    if message_type == "ready":
        # Player is marking themselves ready
        result = await set_player_ready(match_id, player_uid)
        
        # Broadcast ready status to both players
        await broadcast_to_room(match_id, {
            "type": "player_ready",
            "player": player_uid,
            "both_ready": result["both_ready"],
            "question": result.get("question"),
            "match_duration_seconds": MATCH_DURATION_SECONDS if result["both_ready"] else None
        })
    
    elif message_type == "chat":
        # Broadcast chat message to room
        await broadcast_to_room(match_id, {
            "type": "chat",
            "player": player_uid,
            "message": data.get("message", "")
        })
    
    elif message_type == "signal":
        # WebRTC signaling (offer, answer, ICE candidates)
        # Forward to the other player
        await broadcast_to_room(match_id, {
            "type": "signal",
            "from": player_uid,
            "signal": data.get("signal")
        }, exclude_player=player_uid)
    
    elif message_type == "start_audio":
        # Player started speaking - notify opponent
        await broadcast_to_room(match_id, {
            "type": "player_speaking",
            "player": player_uid,
            "speaking": True
        }, exclude_player=player_uid)
    
    elif message_type == "stop_audio":
        # Player stopped speaking - notify opponent
        await broadcast_to_room(match_id, {
            "type": "player_speaking",
            "player": player_uid,
            "speaking": False
        }, exclude_player=player_uid)
    
    else:
        print(f"Unknown message type: {message_type}")


# ==================== CLEANUP TASKS ====================

async def cleanup_expired_rooms():
    """
    Background task to clean up expired or abandoned rooms
    Runs periodically to check room status
    """
    while True:
        try:
            # Get all active rooms
            active_rooms = await redis_client.smembers(ACTIVE_ROOMS_SET)
            
            for match_id in active_rooms:
                room_data = await get_match_room(match_id)
                
                if not room_data:
                    # Room expired from Redis, remove from set
                    await redis_client.srem(ACTIVE_ROOMS_SET, match_id)
                    continue
                
                # Check for abandoned rooms (created but no activity)
                created_at = datetime.fromisoformat(room_data['created_at'])
                age = datetime.now(timezone.utc) - created_at
                
                # Mark rooms abandoned after 10 minutes of inactivity
                if age > timedelta(minutes=10) and room_data['status'] == RoomStatus.WAITING.value:
                    await update_room_status(match_id, RoomStatus.ABANDONED)
            
        except Exception as e:
            print(f"Error in cleanup task: {e}")
        
        # Run every 5 minutes
        await asyncio.sleep(300)