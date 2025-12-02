import json
import redis.asyncio as redis
import httpx


# Initialize Redis client for async operations
# This client is shared across all matchmaking operations
redis_client = redis.Redis(host="localhost", port=6379, db=0)

MATCH_QUEUE = "match_queue"
MATCH_CHANNEL = "match_channel"  # pub/sub channel

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
    queue_size = await redis_client.llen(MATCH_QUEUE)
    if queue_size >= 2:
        p1 = await redis_client.lpop(MATCH_QUEUE)
        p2 = await redis_client.lpop(MATCH_QUEUE)

        p1_uid = p1.decode()
        p2_uid = p2.decode()


        # Match found; match creation hook needs to be implemented
        # Create a game session p1 p2 timestamp
        # Generate a unique match ID using player IDs and current timestamp
        # Using Redis TIME command ensures consistent timing across distributed systems

        redis_time = await redis_client.time()
        match_id = f"match_{p1.decode()}_{p2.decode()}_{int(redis_time[0])}"
        try:
            # Create the actual match room/session
            # This sets up game state, database records, etc.
            room = await create_match_room(match_id, p1_uid, p2_uid)
            print(f"Created match room: {match_id} for players {p1_uid} and {p2_uid}")

        except Exception as e:
            print(f"Error creating match room: {e}")

            # Re-queue players if room creation fails
            await redis_client.rpush(MATCH_QUEUE, p1_uid)
            await redis_client.rpush(MATCH_QUEUE, p2_uid)
            return
        
        # Publish match found event
        await redis_client.publish(MATCH_CHANNEL, json.dumps({
            "players": [p1_uid, p2_uid],
            "match_id": match_id
        }))

async def listen_for_match():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(MATCH_CHANNEL)
    async for message in pubsub.listen():
        if message["type"] == "message":
            yield json.loads(message["data"])
