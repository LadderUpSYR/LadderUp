from quart import Quart, websocket
import uvicorn
import configparser
from pydantic import BaseModel

config = configparser.ConfigParser()
config.read('mmserviceconfig.ini')

# uvicorn websocketserver:matchmaking_service --reload --port 7028 for testing
matchmaking_service = Quart(__name__)

# mm buckets for queues
mm_buckets = {
    "NAMR": {
    "low": set(), # 0-100 elo?
    "medium": set(), # 100-200 elo?
    "high": set() # 200+ elo?
    }
}

@matchmaking_service.route('/')
async def hello():
    return f"Port from config: {config['application']['port']}"


# needs to add in a userId later... token auth and such...
class MatchRequest(BaseModel):
    elo: int
    region: str

# websocket that will handle prompting two players to accept a match
#
@matchmaking_service.websocket('/join_mm_pool')
async def ws():
    '''
    global mm_buckets # current caching of mm buckets
    '''
    global mm_buckets
    # Add the user to the appropriate bucket based on their elo
    try:

    except Exception as e:
        await websocket.send(f"Error: {e}")
        return

if __name__ == "__main__":
    uvicorn.run(matchmaking_service, host="0.0.0.0", port=int(config['application']['port']))
