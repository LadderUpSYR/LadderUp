import os
import firebase_admin
from firebase_admin import credentials, firestore, storage
import redis.asyncio as redis
from dotenv import load_dotenv
from typing import Dict, Optional
import datetime

load_dotenv()

# --- 1. INITIALIZE INFRASTRUCTURE ---

# Initialize Firebase
# Check if already initialized to avoid errors during hot-reloads
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'ladderup-5e25d.firebasestorage.app',
        'projectId': 'ladderup-5e25d',
    })

db = firestore.client()
bucket = storage.bucket()

# Initialize Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)

# Config
SESSION_COOKIE_NAME = "__session"
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

# --- 2. SHARED SESSION HELPERS ---

def build_session_payload(uid: str, name: str, email: str) -> Dict[str, str]:
    """Create a session payload with a refreshed expiry."""
    return {
        "uid": uid,
        "name": name,
        "email": email,
        "expires": str((datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=SESSION_TTL_SECONDS)).timestamp())
    }

async def store_session(session_token: str, data: Dict[str, str]) -> None:
    """Persist session data in Redis."""
    try:
        # Ensure all values are strings for Redis
        redis_payload = {k: str(v) for k, v in data.items()}
        await redis_client.hset(f"session:{session_token}", mapping=redis_payload)
        await redis_client.expire(f"session:{session_token}", SESSION_TTL_SECONDS)
    except Exception as err:
        print(f"[session] Redis error: {err}")

async def get_session(session_token: str) -> Optional[Dict[str, str]]:
    """Retrieve session data."""
    try:
        data = await redis_client.hgetall(f"session:{session_token}")
        if data:
            return data
    except Exception as err:
        print(f"[session] Redis fetch failed: {err}")
    return None

async def delete_session(session_token: str) -> None:
    """Delete session data."""
    try:
        await redis_client.delete(f"session:{session_token}")
    except Exception as err:
        print(f"[session] Redis delete failed: {err}")