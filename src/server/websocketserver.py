from quart import Blueprint, websocket, Quart
import asyncio
import json
from matchmaking import enqueue_player, try_match_players, listen_for_match
from server import get_session

ws_bp = Blueprint("ws", __name__)

SESSION_COOKIE_NAME = "session_token"
app = Quart(__name__)

@app.route("/health")
async def health_check():
    return "OK", 200

@ws_bp.websocket("/ws/join")
async def join_websocket():
    # 1️⃣ Get and validate session
    token = websocket.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        await websocket.send(json.dumps({"error": "Missing session token"}))
        await websocket.close(code=1008)
        return

    session_data = await get_session(token)
    if not session_data:
        await websocket.send(json.dumps({"error": "Invalid or expired session"}))
        await websocket.close(code=1008)
        return

    user_id = session_data["uid"]

    # 2️⃣ Enqueue player in Redis
    await enqueue_player(user_id)
    await websocket.send(json.dumps({"status": "queued", "user": user_id}))

    # 3️⃣ Listen for a match
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
