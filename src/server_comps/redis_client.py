import redis.asyncio as redis

# Initialize Redis client for async operations
# This client is shared across all server components
redis_client = redis.from_url(
    "redis://localhost:6379",
    encoding="utf-8",
    decode_responses=True
)
