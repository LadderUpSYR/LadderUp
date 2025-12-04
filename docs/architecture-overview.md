# Architecture Overview

## System Design

LadderUp is a full-stack interview practice platform that combines solo practice with AI grading and real-time matchmaking for peer-to-peer practice sessions.

## High-Level Architecture

```
┌─────────────┐
│   Browser   │
│   (React)   │
└──────┬──────┘
       │ HTTP/WebSocket
       │
┌──────▼──────────────────┐
│   FastAPI Server        │
│   (Python)              │
│                         │
│  ┌──────────────────┐   │
│  │ REST API         │   │
│  │ Endpoints        │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ WebSocket        │   │
│  │ Handlers         │   │
│  └──────────────────┘   │
└─────┬────────┬──────────┘
      │        │
      │        └──────────┐
      │                   │
┌─────▼─────┐      ┌──────▼──────┐
│ Firebase  │      │   Redis     │
│ Firestore │      │   Cache/    │
│           │      │   Queue     │
└───────────┘      └─────────────┘
```

## Core Components

### 1. Frontend (React)

- **Landing Page**: Initial entry point with authentication
- **Practice Mode**: Solo practice with AI grading
- **Matchmaking**: Real-time peer matching system
- **Profile**: User dashboard with history and analytics
- **Admin Panel**: User management and analytics

### 2. Backend (FastAPI)

#### Main Server (`server.py`)
- RESTful API endpoints
- Session management
- Authentication (Google OAuth & Email/Password)
- Question management
- User profile management
- Resume upload
- Admin endpoints

#### Matchmaking System (`matchmaking.py`)
- Redis-based queue management
- Player pairing algorithm
- Match room creation
- Pub/sub notifications

#### LLM Grading (`llm_grading.py`)
- Google Gemini API integration
- Answer evaluation
- Structured feedback generation
- Security validation

#### Practice STT (`practice_stt_fastapi.py`)
- WebSocket-based audio streaming
- Whisper model integration
- Real-time transcription
- Audio buffer management

### 3. Data Layer

#### Firebase Firestore
- User profiles
- Questions database
- Answered questions history
- Match results

#### Redis
- Session storage
- Matchmaking queue
- Real-time pub/sub messaging
- Cache layer

## Data Flow

### Authentication Flow
```
1. User clicks "Sign In with Google"
2. Frontend receives Google OAuth token
3. Backend verifies token with Google
4. Backend creates/retrieves user from Firestore
5. Backend generates session token (stored in Redis)
6. Session token returned as HTTP-only cookie
7. Frontend stores user info in AuthContext
```

### Practice Mode Flow
```
1. User requests random question
2. Backend retrieves from Firestore
3. User answers (text or video/audio)
4. Answer sent to backend
5. LLM grades answer (Gemini API)
6. Grading stored in user profile
7. Feedback displayed to user
```

### Matchmaking Flow
```
1. User joins matchmaking queue
2. Backend adds player to Redis queue
3. Background task checks for pairs
4. When 2+ players found, create match
5. Publish match event via Redis pub/sub
6. Both players receive match notification
7. Redirect to match room
```

## Security Architecture

### Authentication
- Google OAuth 2.0 for social login
- SHA-256 hashed passwords for email auth
- HTTP-only cookies for session tokens
- Redis session storage with TTL (7 days)
- reCAPTCHA verification on login/signup

### API Security
- Session-based authentication
- CORS configuration for allowed origins
- Input validation and sanitization
- Rate limiting (to be implemented)
- HTTPS in production

### LLM Security
- Input length limits (10,000 chars)
- Prompt injection detection
- Output sanitization
- Suspicious pattern logging

## Scalability Considerations

### Current Architecture
- Single FastAPI server
- Redis for session sharing (multi-instance ready)
- Firebase Firestore (auto-scaling)
- Stateless design (except WebSocket connections)

### Future Improvements
- Load balancer for multiple server instances
- WebSocket connection manager for distributed systems
- CDN for static assets
- Message queue for background jobs
- Caching layer optimization

## Performance Optimizations

1. **Redis Caching**: Session data cached to avoid Firestore reads
2. **Lazy Loading**: Whisper model loaded on first use
3. **Audio Chunking**: Streaming audio processing for low latency
4. **Connection Pooling**: Reused database connections
5. **Async Operations**: Non-blocking I/O throughout

## Monitoring and Logging

- Console logging for development
- Error tracking for exceptions
- Security event logging for suspicious patterns
- Performance metrics (to be implemented)

## Technology Choices

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Backend Framework | FastAPI | High performance, async support, WebSocket |
| Database | Firebase Firestore | NoSQL flexibility, real-time updates, managed |
| Cache/Queue | Redis | In-memory speed, pub/sub, TTL support |
| AI Grading | Google Gemini | State-of-art LLM, structured output |
| STT | Whisper | High accuracy, open source, offline capable |
| Frontend | React | Component-based, ecosystem, developer familiarity |
| Auth | OAuth 2.0 | Industry standard, secure, user convenience |

## Environment Configuration

Required environment variables:
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase credentials
- `GEMINI_API_KEY`: Google AI API key
- `RECAPTCHA_SECRET_KEY`: reCAPTCHA verification

See `.env.example` for complete list.
