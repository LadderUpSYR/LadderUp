import json
import redis.asyncio as redis
import httpx


redis_client = redis.Redis(host="localhost", port=6379, db=0)

MATCH_QUEUE = "match_queue"
MATCH_CHANNEL = "match_channel"  # pub/sub channel



async def enqueue_player(user_id):
    await redis_client.rpush(MATCH_QUEUE, user_id)

async def try_match_players():
    queue_size = await redis_client.llen(MATCH_QUEUE)
    if queue_size >= 2:
        p1 = await redis_client.lpop(MATCH_QUEUE)
        p2 = await redis_client.lpop(MATCH_QUEUE)


        # match found; match creation hook needs to be implemented
        # create a game session p1 p2 timestamp

        redis_time = await redis_client.time()
        match_id = f"match_{p1.decode()}_{p2.decode()}_{int(redis_time[0])}"
        await redis_client.publish(MATCH_CHANNEL, json.dumps({
            "players": [p1.decode(), p2.decode()],
            "match_id": match_id
        }))

async def listen_for_match():
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(MATCH_CHANNEL)
    async for message in pubsub.listen():
        if message["type"] == "message":
            yield json.loads(message["data"])
