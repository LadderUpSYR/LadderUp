# Backend Documentation

The LadderUp backend is built with FastAPI and provides RESTful APIs and WebSocket endpoints for the interview practice platform.

## Overview

The backend is organized into several modules:

- **server.py**: Main FastAPI application with REST endpoints
- **matchmaking.py**: Real-time player matching system
- **llm_grading.py**: AI-powered answer grading
- **practice_stt_fastapi.py**: Speech-to-text for practice mode
- **match_room.py**: Match session management
- **redis_client.py**: Redis connection utilities

## Key Features

1. **Authentication System**
   - Google OAuth 2.0
   - Email/Password authentication
   - Session management with Redis
   - reCAPTCHA protection

2. **Practice Mode**
   - Random question retrieval
   - Answer submission
   - AI grading with detailed feedback
   - Video analytics tracking

3. **Matchmaking**
   - Queue-based player matching
   - Real-time notifications
   - Match room creation

4. **User Management**
   - Profile editing
   - Password changes
   - Account deletion
   - Resume upload

5. **Admin Features**
   - User listing
   - Analytics access

## Tech Stack

- **Framework**: FastAPI 0.x
- **Database**: Firebase Firestore
- **Cache**: Redis
- **AI**: Google Gemini API
- **STT**: Faster Whisper
- **Auth**: Google OAuth 2.0

## File Structure

```
src/server_comps/
├── server.py              # Main API server
├── matchmaking.py         # Matchmaking logic
├── llm_grading.py         # AI grading system
├── practice_stt_fastapi.py # Speech-to-text
├── match_room.py          # Match sessions
├── websocketserver.py     # WebSocket handlers
└── redis_client.py        # Redis utilities
```

## Running the Server

```bash
# Development mode
uvicorn src.server_comps.server:app --reload

# Production mode
uvicorn src.server_comps.server:app --host 0.0.0.0 --port 8000
```

## Detailed Documentation

- [Server API Documentation](./server-api.md) - Complete API reference
- [Authentication System](./authentication.md) - Auth implementation details
- [Matchmaking System](./matchmaking.md) - Matchmaking architecture
- [LLM Grading](./llm-grading.md) - AI grading system
- [Practice STT](./practice-stt.md) - Speech-to-text implementation

## Configuration

The backend requires several environment variables. See the root `.env.example` file for a complete list.

Critical variables:
```env
GOOGLE_CLIENT_ID=your_google_client_id
FIREBASE_SERVICE_ACCOUNT_KEY=path_or_json
GEMINI_API_KEY=your_gemini_api_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret
```

## API Conventions

- All API endpoints are prefixed with `/api/`
- Authentication uses HTTP-only cookies with session tokens
- Errors return appropriate HTTP status codes
- Request/response bodies use JSON format
- WebSocket endpoints are prefixed with `/ws/`

## Error Handling

The server uses FastAPI's HTTPException for error responses:

```python
raise HTTPException(status_code=400, detail="Error message")
```

Common status codes:
- `400`: Bad request (invalid input)
- `401`: Unauthorized (not logged in)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `500`: Internal server error

## Testing

Run tests with pytest:
```bash
pytest
pytest -v  # Verbose output
pytest unittests/test_specific.py  # Specific test file
```

See the testing documentation for more details.
