import json
import redis.asyncio as redis
import httpx
import os

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

# Note: Keeping db=0 to match your other configs
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)

MATCH_QUEUE = "match_queue"
MATCH_CHANNEL = "match_channel"
from .match_room import create_match_room

# Add a player to the matchmaking queue
async def enqueue_player(user_id):
    await redis_client.rpush(MATCH_QUEUE, user_id)

async def dequeue_player(user_id):
    """Remove a player from the matchmaking queue"""
    await redis_client.lrem(MATCH_QUEUE, 0, user_id)

# Try to match players in the queue
# Process:
#    1. Check if at least 2 players are in the queue
#    2. Pop the first 2 players (FIFO order)
#    3. Create a match room for them
#    4. Publish a match event so clients can be notified
#    5. If room creation fails, re-queue the players
async def try_match_players():
    try:
        # Check queue size first to avoid unnecessary pops
        queue_size = await redis_client.llen(MATCH_QUEUE)
        # print(f"DEBUG: Queue size: {queue_size}") # Uncomment if needed, but might be noisy

        if queue_size < 2:
            return

        print(f"DEBUG: Attempting to match. Queue size: {queue_size}")

        p1 = await redis_client.lpop(MATCH_QUEUE)
        p2 = await redis_client.lpop(MATCH_QUEUE)

        if not p1:
            return 
        
        if not p2:
            # Put p1 back if p2 is missing (rare race condition)
            print(f"DEBUG: Found p1 ({p1}) but no p2. Returning p1 to queue.")
            await redis_client.lpush(MATCH_QUEUE, p1)
            return

        # p1 and p2 are ALREADY STRINGS because decode_responses=True
        p1_uid = p1
        p2_uid = p2

        print(f"DEBUG: Matched pair: {p1_uid} and {p2_uid}")
        # Match found; match creation hook needs to be implemented
        # Create a game session p1 p2 timestamp
        # Generate a unique match ID using player IDs and current timestamp
        # Using Redis TIME command ensures consistent timing across distributed systems

        # Create Match ID
        redis_time = await redis_client.time()
        match_id = f"match_{p1_uid}_{p2_uid}_{int(redis_time[0])}"
        
        try:
            print(f"DEBUG: Creating room {match_id}...")
            await create_match_room(match_id, p1_uid, p2_uid)
            print(f"DEBUG: Room {match_id} created successfully.")

        except Exception as e:
            print(f"ERROR creating match room: {e}")
            # Re-queue players if room creation fails
            await redis_client.rpush(MATCH_QUEUE, p1_uid)
            await redis_client.rpush(MATCH_QUEUE, p2_uid)
            return
        
        # Publish match found event
        message = json.dumps({
            "players": [p1_uid, p2_uid],
            "match_id": match_id
        })
        print(f"DEBUG: Publishing match event: {message}")
        await redis_client.publish(MATCH_CHANNEL, message)

    except Exception as e:
        print(f"CRITICAL ERROR in try_match_players: {e}")


async def listen_for_match():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(MATCH_CHANNEL)
    async for message in pubsub.listen():
        if message["type"] == "message":
            yield json.loads(message["data"])
