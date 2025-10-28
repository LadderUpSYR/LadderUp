"""
Match Room System for 1v1 Interview Practice
Handles room creation, player authentication, timed questions, and video streaming
"""

import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Set, Optional
import redis.asyncio as redis
from quart import Blueprint, websocket, request, jsonify
from dataclasses import dataclass, asdict
from enum import Enum
import random

# Initialize Redis client
redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)

# Constants
ROOM_PREFIX = "room:"
ROOM_TTL_SECONDS = 3600  # 1 hour room lifetime
ACTIVE_ROOMS_SET = "active_rooms"
MATCH_DURATION_SECONDS = 420  # 7 minutes (420 seconds) for the match

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


async def start_match_timer(match_id: str):
    """
    Start a countdown timer for the match
    Broadcasts time updates every 30 seconds
    Automatically completes match when time expires
    """
    room_key = f"{ROOM_PREFIX}{match_id}"
    time_remaining = MATCH_DURATION_SECONDS
    
    try:
        while time_remaining > 0:
            # Update time remaining in Redis
            await redis_client.hset(room_key, "time_remaining", str(time_remaining))
            
            # Broadcast time update to all players
            await broadcast_to_room(match_id, {
                "type": "time_update",
                "time_remaining": time_remaining,
                "minutes": time_remaining // 60,
                "seconds": time_remaining % 60
            })
            
            if time_remaining == 60:  # 1 minute warning
                await broadcast_to_room(match_id, {
                    "type": "time_warning",
                    "message": "1 minute remaining!",
                    "time_remaining": 60
                })
            elif time_remaining == 30:  # 30 second warning
                await broadcast_to_room(match_id, {
                    "type": "time_warning",
                    "message": "30 seconds remaining!",
                    "time_remaining": 30
                })
            
            # Wait 30 seconds before next update (or less if near end)
            wait_time = min(30, time_remaining)
            await asyncio.sleep(wait_time)
            time_remaining -= wait_time
        
        # Time expired - complete the match
        await update_room_status(match_id, RoomStatus.COMPLETED)
        await broadcast_to_room(match_id, {
            "type": "match_time_expired",
            "message": "Time's up! Match completed."
        })
        
        print(f"Match {match_id} timer expired - match completed")
        
        
    except asyncio.CancelledError:
        # Timer was cancelled (manual completion or abandonment)
        print(f"Timer cancelled for match {match_id}")
    finally:
        # Clean up timer reference
        if match_id in active_timers:
            del active_timers[match_id]


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
        
        # LOG: Both players ready event
        # await log_room_event(match_id, "both_players_ready", {"question_id": question["id"]})
        
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
    if match_id not in active_connections:
        return
    
    message_json = json.dumps(message)
    
    for player_uid, ws in active_connections[match_id].items():
        if exclude_player and player_uid == exclude_player:
            continue
        try:
            await ws.send(message_json)
        except Exception as e:
            print(f"Error broadcasting to player {player_uid}: {e}")
            # LOG: Broadcast error
            # await log_room_event(match_id, "broadcast_error", {"player": player_uid, "error": str(e)})


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
    - Video stream chunks
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
    active_connections[match_id][player_uid] = websocket
    
    # LOG: Player connected to room
    # await log_room_event(match_id, "player_connected", {"player": player_uid})
    
    # Notify room of player join
    await broadcast_to_room(match_id, {
        "type": "player_joined",
        "player": player_uid
    }, exclude_player=player_uid)
    
    room_data = await get_match_room(match_id)
    connection_message = {
        "type": "connected",
        "match_id": match_id,
        "player_uid": player_uid,
        "status": room_data.get('status') if room_data else 'waiting'
    }
    
    if room_data and room_data.get('question_text'):
        connection_message["question"] = {
            "id": room_data.get('question_id'),
            "text": room_data.get('question_text')
        }
        connection_message["time_remaining"] = room_data.get('time_remaining')
    
    await websocket.send(json.dumps(connection_message))
    
    try:
        while True:
            message = await websocket.receive()
            # Handle different message types
            try:
                if isinstance(message, bytes):
                    # Binary data (video stream chunks)
                    await handle_video_stream(match_id, player_uid, message)
                else:
                    # JSON messages
                    data = json.loads(message)
                    await handle_room_message(match_id, player_uid, data)
            except json.JSONDecodeError:
                await websocket.send(json.dumps({"error": "Invalid message format"}))
            except Exception as e:
                print(f"Error handling message: {e}")
                # LOG: Message handling error
                # await log_room_event(match_id, "message_error", {"player": player_uid, "error": str(e)})
    
    except asyncio.CancelledError:
        print(f"Player {player_uid} disconnected from room {match_id}")
    finally:
        # Cleanup connection
        if match_id in active_connections and player_uid in active_connections[match_id]:
            del active_connections[match_id][player_uid]
            
            # If room is empty, clean up
            if not active_connections[match_id]:
                del active_connections[match_id]
                # FEATURE: Auto-close abandoned rooms after timeout
        
        # LOG: Player disconnected
        # await log_room_event(match_id, "player_disconnected", {"player": player_uid})
        
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
    
    else:
        print(f"Unknown message type: {message_type}")


async def handle_video_stream(match_id: str, player_uid: str, video_chunk: bytes):
    """
    Handle incoming video stream data
    
    This will:
    1. Store video chunk for processing (speech-to-text)
    2. Forward to server for analysis
    
    Args:
        match_id: The room ID
        player_uid: The player sending video
        video_chunk: Binary video data
    """
    # FEATURE: Send video chunk to speech-to-text processing service
    # await send_to_stt_service(match_id, player_uid, video_chunk)
    
    # FEATURE: Store video chunks for replay functionality
    # await store_video_chunk(match_id, player_uid, video_chunk)
    
    # LOG: Video chunk received
    # await log_video_metrics(match_id, player_uid, len(video_chunk))
    
    pass  # Placeholder for video processing logic




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
                
                # FEATURE: Mark rooms abandoned after 10 minutes of inactivity
                if age > timedelta(minutes=10) and room_data['status'] == RoomStatus.WAITING.value:
                    await update_room_status(match_id, RoomStatus.ABANDONED)
                    # LOG: Room abandoned
                    # await log_room_event(match_id, "room_abandoned", {"age_minutes": age.total_seconds() / 60})
            
        except Exception as e:
            print(f"Error in cleanup task: {e}")
        
        # Run every 5 minutes
        await asyncio.sleep(300)

