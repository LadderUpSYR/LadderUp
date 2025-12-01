from quart import Blueprint, websocket, Quart
from quart_cors import cors
import asyncio
import json
from src.server_comps.matchmaking import enqueue_player, dequeue_player, try_match_players, listen_for_match
from src.server_comps.match_room import match_room_bp
from src.server_comps.server import get_session
import os



# 8000
ws_bp = Blueprint("ws", __name__)

SESSION_COOKIE_NAME = "__session"
app = Quart(__name__)

# Configure CORS to allow requests from the React frontend
ALLOWED_ORIGINS = [
    "http://localhost:3000", 
    "https://ladderup-5e25d.web.app", 
    "https://ladderup-5e25d.firebaseapp.com"
]

app = cors(app, allow_origin=ALLOWED_ORIGINS, allow_credentials=True)

@app.route("/health")
async def health_check():
    return "OK", 200

@ws_bp.websocket("/ws/join")
async def join_websocket():
    await websocket.accept()

    # --- NEW AUTH HANDSHAKE START ---
    try:
        # 1. Wait max 5 seconds for the client to send the authentication message
        message = await asyncio.wait_for(websocket.receive(), timeout=5.0)
        data = json.loads(message)

        # 2. Check if the message is the correct type
        if data.get("type") != "authenticate":
            print("DEBUG: First message was not authentication")
            await websocket.close(code=1008)
            return

        token = data.get("token")
    
    except asyncio.TimeoutError:
        print("DEBUG: Auth timeout")
        await websocket.close(code=1008)
        return
    except Exception as e:
        print(f"DEBUG: Auth error: {e}")
        await websocket.close(code=1008)
        return
    # --- NEW AUTH HANDSHAKE END ---

    session_data = await get_session(token)
    
    if not session_data:
        await websocket.send(json.dumps({"error": "Invalid or expired session"}))
        await websocket.close(code=1008)
        return

    user_id = session_data["uid"]
    print(f"DEBUG: Authenticated user {user_id}")
    await enqueue_player(user_id)
    await websocket.send(json.dumps({"status": "queued", "user": user_id}))

    try:
        async for match in listen_for_match():
            if user_id in match["players"]:
                partner = match["players"][1] if match["players"][0] == user_id else match["players"][0]
                await websocket.send(json.dumps({
                    "status": "match_found",
                    "partner": partner,
                    "match_id": match["match_id"]
                }))

                # match creation hook is not implemented here
                # but we return with match id to direct both users to the same room



                print(f"User {user_id} matched with {partner}")

                break

    except asyncio.CancelledError:
        print(f"User {user_id} disconnected from matchmaking")
    finally:
        # Remove player from queue when they disconnect
        await dequeue_player(user_id)
        print(f"User {user_id} removed from queue")


# --- Matchmaking Background Task ---
async def matchmaking_background_task():
    while True:
        await try_match_players()
        # Poll the queue every 1 second
        await asyncio.sleep(1) 

@app.before_serving
async def start_tasks():
    # Start the matchmaking task and store it on the app object
    app.matchmaking_task = asyncio.create_task(matchmaking_background_task())

# Add a cleanup step for when the server shuts down
@app.after_serving
async def stop_tasks():
    app.matchmaking_task.cancel()
    # Wait for cancellation to complete
    try:
        await app.matchmaking_task
    except asyncio.CancelledError:
        pass

app.register_blueprint(ws_bp)
app.register_blueprint(match_room_bp)
# Note: practice_stt is now handled by FastAPI in server.py, not Quart