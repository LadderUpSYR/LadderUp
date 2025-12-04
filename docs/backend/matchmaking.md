# Matchmaking System Documentation

Documentation for `src/server_comps/matchmaking.py` - Real-time player matching system using Redis.

## Overview

The matchmaking system pairs players for interview practice sessions using a Redis-based queue and pub/sub messaging.

## Architecture

```
Player A joins → Redis Queue → Background Task checks queue →
Player B joins → Match Found → Create Match Room →
Publish to Redis Pub/Sub → Both players notified
```

## Dependencies

```python
import redis.asyncio as redis
from .match_room import create_match_room
```

## Redis Configuration

```python
redis_client = redis.Redis(
    host="localhost",
    port=6379,
    db=0
)
```

### Redis Data Structures

**Queue:** `match_queue` (List)
- Stores user IDs waiting for match
- FIFO (first in, first out)

**Channel:** `match_channel` (Pub/Sub)
- Broadcasts match creation events
- Subscribers receive real-time notifications

## Key Functions

### enqueue_player()

Adds player to matchmaking queue.

```python
async def enqueue_player(user_id: str) -> None
```

**Parameters:**
- `user_id`: Unique user identifier

**Implementation:**
```python
await redis_client.rpush(MATCH_QUEUE, user_id)
```

**Behavior:**
- Appends to end of queue (FIFO)
- No duplicate checking (user can queue multiple times)
- Returns immediately (non-blocking)

**Usage:**
```python
from src.server_comps.matchmaking import enqueue_player

await enqueue_player("user_123")
```

### dequeue_player()

Removes player from matchmaking queue.

```python
async def dequeue_player(user_id: str) -> None
```

**Parameters:**
- `user_id`: User to remove

**Implementation:**
```python
await redis_client.lrem(MATCH_QUEUE, 0, user_id)
```

**Behavior:**
- Removes ALL occurrences of user_id
- Safe to call if user not in queue
- Used when player cancels or disconnects

**Usage:**
```python
await dequeue_player("user_123")
```

### try_match_players()

Attempts to create a match from queued players.

```python
async def try_match_players() -> None
```

**Process:**

1. **Check Queue Size**
   ```python
   queue_size = await redis_client.llen(MATCH_QUEUE)
   if queue_size < 2:
       return  # Not enough players
   ```

2. **Pop Two Players**
   ```python
   p1 = await redis_client.lpop(MATCH_QUEUE)  # First in queue
   p2 = await redis_client.lpop(MATCH_QUEUE)  # Second in queue
   ```

3. **Generate Match ID**
   ```python
   redis_time = await redis_client.time()
   match_id = f"match_{p1_uid}_{p2_uid}_{int(redis_time[0])}"
   ```
   Format: `match_{player1}_{player2}_{timestamp}`

4. **Create Match Room**
   ```python
   room = await create_match_room(match_id, p1_uid, p2_uid)
   ```

5. **Publish Event**
   ```python
   await redis_client.publish(MATCH_CHANNEL, json.dumps({
       "players": [p1_uid, p2_uid],
       "match_id": match_id
   }))
   ```

**Error Handling:**

If room creation fails:
```python
except Exception as e:
    # Re-queue both players
    await redis_client.rpush(MATCH_QUEUE, p1_uid)
    await redis_client.rpush(MATCH_QUEUE, p2_uid)
    return
```

**Fairness:**
- FIFO order (first joined, first matched)
- Failed matches return players to queue
- No priority system (future enhancement)

### listen_for_match()

Async generator for receiving match notifications.

```python
async def listen_for_match() -> AsyncGenerator
```

**Returns:**
- Yields match events as dictionaries

**Implementation:**
```python
pubsub = redis_client.pubsub()
await pubsub.subscribe(MATCH_CHANNEL)
async for message in pubsub.listen():
    if message["type"] == "message":
        yield json.loads(message["data"])
```

**Event Format:**
```python
{
    "players": ["user_123", "user_456"],
    "match_id": "match_user_123_user_456_1732464000"
}
```

**Usage:**
```python
async for match_event in listen_for_match():
    player1 = match_event["players"][0]
    player2 = match_event["players"][1]
    match_id = match_event["match_id"]
    # Notify players via WebSocket
```

## Match Flow

### Complete Matchmaking Sequence

```
1. Player A joins queue
   └─→ enqueue_player("player_a")

2. Background task runs
   └─→ try_match_players()
       └─→ queue_size = 1 (not enough)

3. Player B joins queue
   └─→ enqueue_player("player_b")

4. Background task runs again
   └─→ try_match_players()
       ├─→ queue_size = 2 (enough!)
       ├─→ lpop() → player_a
       ├─→ lpop() → player_b
       ├─→ create_match_room()
       └─→ publish to match_channel

5. WebSocket listeners receive event
   └─→ listen_for_match() yields match data

6. Both players notified
   └─→ Redirect to match room
```

## Background Task Integration

From `websocketserver.py`:

```python
async def matchmaking_background_task():
    """Periodically check for matches"""
    while True:
        try:
            await try_match_players()
        except Exception as e:
            print(f"Matchmaking error: {e}")
        await asyncio.sleep(2)  # Check every 2 seconds
```

## Match Room Creation

The `create_match_room()` function (from `match_room.py`):

```python
async def create_match_room(
    match_id: str,
    player1_uid: str,
    player2_uid: str
) -> Dict
```

**Responsibilities:**
- Create match session in database
- Initialize match state
- Set up question for both players
- Return room configuration

**Stored in Redis:**
```python
{
    "match_id": str,
    "player1": str,
    "player2": str,
    "created_at": timestamp,
    "status": "active",
    "question_id": str,
    "question_text": str
}
```

## Client Integration

### Joining Queue (Frontend)

```javascript
// WebSocket message to join queue
socket.send(JSON.stringify({
    type: "join_queue",
    user_id: currentUser.uid
}));
```

### Leaving Queue

```javascript
socket.send(JSON.stringify({
    type: "leave_queue",
    user_id: currentUser.uid
}));
```

### Receiving Match Notification

```javascript
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === "match_found") {
        const matchId = data.match_id;
        const partner = data.partner_id;
        // Redirect to match room
        window.location.href = `/match/${matchId}`;
    }
};
```

## Error Scenarios

### Player Disconnects After Queue

```python
# WebSocket disconnect handler
async def handle_disconnect(user_id):
    await dequeue_player(user_id)
```

### Room Creation Fails

Players re-queued automatically:
```python
await redis_client.rpush(MATCH_QUEUE, p1_uid)
await redis_client.rpush(MATCH_QUEUE, p2_uid)
```

### Redis Connection Lost

Matchmaking stops until Redis reconnects. Consider:
- Connection retry logic
- Client-side timeout notifications
- Health check endpoints

## Performance Considerations

### Polling Frequency

Current: 2 seconds
```python
await asyncio.sleep(2)
```

**Tradeoffs:**
- Faster: Lower latency, higher CPU/Redis load
- Slower: Higher latency, lower resource usage

**Recommendation:**
- 1-2 seconds for good UX
- Add exponential backoff if queue empty

### Scalability

**Current Limitations:**
- Single background task
- No horizontal scaling (yet)

**Improvements:**
- Redis distributed locks for multi-instance
- Separate matchmaking service
- Priority queues for skill-based matching

## Queue Statistics

### Get Queue Size

```python
queue_size = await redis_client.llen(MATCH_QUEUE)
```

Used by `/api/matchmaking/queue-status` endpoint in `server.py`:
```python
@app.get("/api/matchmaking/queue-status")
async def get_queue_status():
    queue_size = await redis_client.llen("match_queue")
    estimated_wait_seconds = calculate_wait_time(queue_size)
    return {
        "queue_size": queue_size,
        "estimated_wait_seconds": estimated_wait_seconds
    }
```

## Security Considerations

### User Verification

**Current:** Trust user_id from client (not secure)

**Recommended:**
```python
async def enqueue_player(session_token: str):
    # Verify session
    session = await get_session(session_token)
    if not session:
        raise HTTPException(401, "Unauthorized")
    
    user_id = session["uid"]
    await redis_client.rpush(MATCH_QUEUE, user_id)
```

### Duplicate Prevention

Prevent user from being in queue multiple times:
```python
async def enqueue_player(user_id: str):
    # Check if already in queue
    queue = await redis_client.lrange(MATCH_QUEUE, 0, -1)
    if user_id.encode() in queue:
        return  # Already queued
    
    await redis_client.rpush(MATCH_QUEUE, user_id)
```

### Rate Limiting

Prevent queue spam:
```python
# Track join attempts
join_key = f"join_attempts:{user_id}"
attempts = await redis_client.incr(join_key)
await redis_client.expire(join_key, 60)  # Reset after 1 minute

if attempts > 10:
    raise HTTPException(429, "Too many requests")
```

## Monitoring

### Metrics to Track

- Queue length over time
- Average wait time
- Match success rate
- Room creation failures
- Concurrent matches

### Health Checks

```python
async def check_matchmaking_health():
    try:
        await redis_client.ping()
        queue_size = await redis_client.llen(MATCH_QUEUE)
        return {
            "status": "healthy",
            "queue_size": queue_size
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
```

## Future Enhancements

### 1. Skill-Based Matching

```python
# Store skill ratings
await redis_client.zadd("match_queue_ranked", {
    user_id: skill_rating
})

# Match similar skills
players = await redis_client.zrangebyscore(
    "match_queue_ranked",
    rating - tolerance,
    rating + tolerance,
    num=2
)
```

### 2. Match Preferences

```python
{
    "user_id": "player_a",
    "preferences": {
        "difficulty": "medium",
        "topics": ["behavioral", "technical"],
        "duration": 30
    }
}
```

### 3. Priority Queue

```python
# VIP or long-wait users get priority
await redis_client.zadd("match_queue_priority", {
    user_id: priority_score
})
```

### 4. Geographic Matching

Match players in same region for lower latency.

### 5. Match History

Prevent matching same players repeatedly.

```python
recent_matches = await get_recent_partners(user_id)
# Exclude from potential matches
```

## Testing

### Unit Tests

```bash
pytest unittests/test_matchmaking_api.py
```

### Mock Redis

```python
from unittest.mock import AsyncMock

redis_client.rpush = AsyncMock()
redis_client.lpop = AsyncMock(return_value=b"user_123")
redis_client.llen = AsyncMock(return_value=2)

await try_match_players()
```

### Integration Tests

Test full flow:
1. Two players join
2. Match created
3. Notification received
4. Room accessible

## Related Documentation

- [Server API](./server-api.md)
- [Match Room](./match-room.md)
- [WebSocket Server](./websocket-server.md)
- [Architecture Overview](../architecture-overview.md)
