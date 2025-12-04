# Server API Documentation

Complete documentation for `src/server_comps/server.py` - the main FastAPI application server.

## Overview

The server is the core backend application built with FastAPI. It handles:
- User authentication (Google OAuth & Email/Password)
- Session management (Redis-based)
- Question management
- Answer submission and AI grading
- User profile management
- Admin functionality
- File uploads (resumes)
- Practice mode WebSocket

## Table of Contents

1. [Dependencies](#dependencies)
2. [Configuration](#configuration)
3. [Session Management](#session-management)
4. [Authentication Endpoints](#authentication-endpoints)
5. [Question Endpoints](#question-endpoints)
6. [Profile Endpoints](#profile-endpoints)
7. [Admin Endpoints](#admin-endpoints)
8. [WebSocket Endpoints](#websocket-endpoints)
9. [Utility Functions](#utility-functions)

---

## Dependencies

### External Libraries
```python
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import id_token
from google.auth.transport import requests
import firebase_admin
from firebase_admin import credentials, firestore, storage
import redis.asyncio as redis
```

### Internal Modules
```python
from .practice_stt_fastapi import practice_stt_websocket_handler
from src.server_comps.llm_grading import get_grader
from src.utils.yamlparser import Question
```

---

## Configuration

### Environment Variables

Required environment variables:
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase service account JSON or path
- `GEMINI_API_KEY`: Google Gemini API key for grading
- `RECAPTCHA_SECRET_KEY`: reCAPTCHA secret for bot protection
- `TESTING`: Set to "1" to bypass reCAPTCHA in tests

### Firebase Initialization

```python
# Loads service account key from environment
# Supports both JSON string and file path
cred = credentials.Certificate(SERVICE_ACCOUNT_KEY)
firebase_admin.initialize_app(cred, {
    'storageBucket': 'ladderup-5e25d.firebasestorage.app'
})
db = firestore.client()
bucket = storage.bucket()
```

### CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000", 
                   "http://localhost:5000", "http://localhost:5001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Allows requests from local development servers with credentials (cookies).

### Redis Configuration

```python
redis_client = redis.Redis(
    host="localhost", 
    port=6379, 
    db=0, 
    decode_responses=True
)
SESSION_PREFIX = "session:"
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days
```

---

## Session Management

The server uses a hybrid session storage approach with Redis as primary and in-memory fallback.

### Session Storage Architecture

**Primary**: Redis (for production, persistence, multi-instance support)
**Fallback**: In-memory dictionary (when Redis unavailable)

### Key Functions

#### `build_session_payload(uid, name, email)`

Creates a session payload with user data and expiry timestamp.

**Parameters:**
- `uid` (str): User unique identifier
- `name` (str): User's display name
- `email` (str): User's email address

**Returns:**
```python
{
    "uid": str,
    "name": str,
    "email": str,
    "expires": str  # Unix timestamp
}
```

#### `store_session(session_token, data)`

Persists session data to Redis with automatic expiration. Falls back to in-memory storage if Redis unavailable.

**Parameters:**
- `session_token` (str): Unique session identifier (URL-safe random token)
- `data` (Dict): Session payload from `build_session_payload`

**Implementation:**
- Stores as Redis hash with key `session:{token}`
- Sets TTL to 7 days
- Falls back to memory_sessions dict on Redis error

#### `get_session(session_token)`

Retrieves session data from Redis or memory.

**Parameters:**
- `session_token` (str): Session identifier

**Returns:**
- `Dict[str, str]`: Session data if valid
- `None`: If session not found or expired

**Expiration Check:**
- Automatically removes expired sessions from memory
- Redis handles expiration automatically via TTL

#### `delete_session(session_token)`

Removes session from both Redis and memory.

**Parameters:**
- `session_token` (str): Session identifier

**Use Cases:**
- User logout
- Session invalidation
- Account deletion

---

## Authentication Endpoints

### Health Check

#### `GET /health`

Simple health check endpoint.

**Response:**
```json
{
    "ok": true
}
```

**Use:** Load balancer health checks, monitoring

---

### Google OAuth Login

#### `POST /api/auth/login`

Authenticates user with Google OAuth token and creates session.

**Request Body:**
```json
{
    "token": "google_oauth_token",
    "recaptchaToken": "recaptcha_response_token"
}
```

**Process:**
1. Verify reCAPTCHA token
2. Verify Google OAuth token with Google's servers
3. Extract user info (uid, email, name)
4. Check if user exists in Firestore
5. Create new user profile if first login
6. Generate session token
7. Store session in Redis
8. Set HTTP-only cookie
9. Return user data

**Response:**
```json
{
    "user": {
        "uid": "google_user_id",
        "name": "User Name",
        "email": "user@example.com",
        "is_admin": false
    },
    "msg": "User Exists" | "New user created"
}
```

**Cookies Set:**
- `session_token`: HTTP-only, 7-day expiry, SameSite=Lax

**Error Codes:**
- `400`: Missing token or reCAPTCHA failure
- `401`: Invalid Google token
- `500`: Server error or misconfiguration

**Security:**
- Verifies token signature with Google
- reCAPTCHA protects against bots
- Session tokens are cryptographically random (32 bytes)

---

### Email/Password Signup

#### `POST /api/auth/signup`

Creates new user account with email and password.

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "secure_password",
    "name": "User Name",
    "recaptchaToken": "recaptcha_response_token"
}
```

**Validation:**
- Email must contain "@"
- Password minimum 6 characters
- Name minimum 2 characters
- Email must be unique
- reCAPTCHA must pass

**Process:**
1. Verify reCAPTCHA
2. Validate input format
3. Check email uniqueness in Firestore
4. Generate unique UUID for user
5. Hash password with SHA-256
6. Create user document in Firestore
7. Generate and store session
8. Return user data with cookie

**User Document Structure:**
```python
{
    "uid": "uuid-v4",
    "email": "user@example.com",
    "name": "User Name",
    "password_hash": "sha256_hash",
    "created_at": "ISO-8601 timestamp",
    "questions": [],
    "answered_questions": [],
    "auth_provider": "email"
}
```

**Response:**
```json
{
    "user": {
        "uid": "uuid",
        "name": "User Name",
        "email": "user@example.com"
    },
    "msg": "Account created successfully"
}
```

**Error Codes:**
- `400`: Invalid input or reCAPTCHA failure
- `409`: Email already registered
- `500`: Server error

---

### Email/Password Login

#### `POST /api/auth/login-email`

Authenticates user with email and password.

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "password",
    "recaptchaToken": "recaptcha_response_token"
}
```

**Process:**
1. Verify reCAPTCHA
2. Find user by email in Firestore
3. Verify auth_provider is "email" (not Google)
4. Hash provided password
5. Compare with stored hash
6. Create session on success
7. Return user data with cookie

**Response:**
```json
{
    "user": {
        "uid": "uuid",
        "name": "User Name",
        "email": "user@example.com",
        "is_admin": false
    },
    "msg": "Login successful"
}
```

**Error Codes:**
- `400`: Missing credentials or reCAPTCHA failure
- `401`: Invalid credentials or wrong auth provider
- `500`: Server error

**Security Notes:**
- Prevents OAuth users from using password login
- Generic error messages to prevent user enumeration
- Rate limiting recommended (not implemented)

---

### Logout

#### `POST /api/auth/logout`

Logs out user by deleting session.

**Authentication:** Requires session cookie

**Process:**
1. Extract session token from cookie
2. Delete session from Redis and memory
3. Delete session cookie
4. Return success message

**Response:**
```json
{
    "msg": "Successfully signed out"
}
```

**Notes:**
- Always returns success even if no session exists
- Cookie deleted on client side regardless of server state
- Idempotent operation

---

### Get Current User

#### `GET /api/auth/me`

Returns current authenticated user's information.

**Authentication:** Requires session cookie

**Process:**
1. Extract session token from cookie
2. Retrieve session from Redis/memory
3. Check expiration timestamp
4. Delete if expired
5. Fetch admin status from Firestore
6. Return user data

**Response:**
```json
{
    "user": {
        "uid": "user_id",
        "name": "User Name",
        "email": "user@example.com",
        "is_admin": false
    }
}
```

**Error Codes:**
- `401`: Not authenticated, invalid session, or expired

**Use Cases:**
- Check login status on app load
- Refresh user data
- Verify authentication before protected actions

---

## Question Endpoints

### Get Question by ID

#### `POST /api/question/id`

Retrieves a specific question by its ID.

**Request Body:**
```json
{
    "questionId": 123
}
```

**Process:**
1. Query Firestore for question document
2. Return question data if found
3. Return default question if not found

**Response:**
```json
{
    "answerCriteria": "Grading criteria...",
    "avgScore": 1.0,
    "numAttempts": 0,
    "question": "Question text..."
}
```

**Default Question:**
Returned when questionId not found in database:
```json
{
    "answerCriteria": "This question should follow the STAR principle...",
    "avgScore": 1,
    "numAttempts": 0,
    "question": "Tell us about a time you had a great team member..."
}
```

---

### Get Random Question

#### `GET /api/question/random`

Returns a random question from the database.

**Process:**
1. Fetch all questions from Firestore
2. Add document ID as questionId to each
3. Randomly select one question
4. Return default if database empty

**Response:**
```json
{
    "questionId": "doc_id",
    "answerCriteria": "Criteria...",
    "avgScore": 1.0,
    "numAttempts": 0,
    "question": "Question text..."
}
```

**Error Codes:**
- `500`: Database error

**Performance Note:**
- Loads all questions into memory
- Consider pagination for large datasets

---

### Submit Answer

#### `POST /api/question/submit`

Submits an answer for AI grading and saves to user profile.

**Authentication:** Requires session cookie

**Request Body:**
```json
{
    "questionId": "question_id",
    "question": "Question text",
    "answer": "User's answer text",
    "answerCriteria": "Grading criteria (optional)",
    "videoAnalytics": {
        "avgConfidence": 0.85,
        "eyeContactPercentage": 75,
        "neutralExpressionPercentage": 60
    }
}
```

**Process:**
1. Authenticate user from session
2. Validate question and answer not empty
3. Create Question object for grader
4. Grade answer using LLM (Gemini)
5. Retrieve user profile from Firestore
6. Create answer record with grading results
7. Update or append to answered_questions array
8. Save to Firestore
9. Return grading results

**Answer Record Structure:**
```python
{
    "questionId": str,
    "question": str,
    "answer": str,
    "score": float,  # 0-100
    "feedback": str,  # Overall feedback
    "strengths": [str],  # List of strengths
    "improvements": [str],  # List of improvements
    "date": str,  # ISO-8601 timestamp
    "gradedBy": "gemini-ai",
    "videoMetrics": {...}  # Optional
}
```

**Response:**
```json
{
    "msg": "Answer submitted and graded successfully",
    "answer_record": { /* answer record */ },
    "total_answered": 5,
    "grading": {
        "score": 85,
        "feedback": "Great answer...",
        "strengths": ["Clear structure", "Good examples"],
        "improvements": ["Add more details"]
    }
}
```

**Error Codes:**
- `400`: Missing question or answer
- `401`: Not authenticated
- `500`: Grading or database error

**Video Analytics:**
- Optional field from video practice mode
- Includes facial recognition metrics
- Stored with answer for analytics

**Deduplication:**
- If same questionId already answered, updates existing record
- Keeps most recent attempt
- No history of previous attempts (future enhancement)

---

## Profile Endpoints

### Edit Profile

#### `PUT /api/profile/edit`

Updates user's display name.

**Authentication:** Requires session cookie

**Request Body:**
```json
{
    "name": "New Name"
}
```

**Validation:**
- Name minimum 2 characters

**Process:**
1. Authenticate user
2. Validate name length
3. Update Firestore user document
4. Update session cache
5. Return success with updated data

**Response:**
```json
{
    "msg": "Profile updated successfully",
    "user": {
        "uid": "user_id",
        "name": "New Name",
        "email": "user@example.com"
    }
}
```

**Error Codes:**
- `400`: Invalid name
- `401`: Not authenticated
- `500`: Update failed

---

### Change Password

#### `PUT /api/profile/change-password`

Changes password for email auth users only.

**Authentication:** Requires session cookie

**Request Body:**
```json
{
    "password": "new_password"
}
```

**Validation:**
- Password minimum 6 characters
- User must use email auth (not OAuth)

**Process:**
1. Authenticate user
2. Validate password length
3. Verify auth_provider is "email"
4. Hash new password
5. Update password_hash in Firestore
6. Return success

**Response:**
```json
{
    "msg": "Password updated successfully"
}
```

**Error Codes:**
- `400`: Invalid password or OAuth account
- `401`: Not authenticated
- `404`: User not found
- `500`: Update failed

**Security:**
- Only allows password changes for email auth users
- OAuth users must use their provider's password reset
- Prevents mixing auth methods

---

### Delete Account

#### `DELETE /api/auth/delete-account`

Permanently deletes user account and all data.

**Authentication:** Requires session cookie

**Process:**
1. Authenticate user
2. Delete user document from Firestore
3. Delete session
4. Delete session cookie
5. Return success

**Response:**
```json
{
    "msg": "Account deleted successfully"
}
```

**Error Codes:**
- `401`: Not authenticated
- `500`: Deletion failed

**Data Deleted:**
- User profile
- Answered questions history
- Session data

**NOT Deleted:**
- Uploaded resumes (consider implementing)
- Match history (if stored separately)

**Important:** This is irreversible!

---

### Upload Resume

#### `POST /api/profile/upload-resume`

Uploads user's resume to Firebase Storage.

**Authentication:** Requires session cookie

**Request:** Multipart form data
- `file`: PDF file (required)

**Validation:**
- File must be .pdf extension
- File size max 10MB

**Process:**
1. Authenticate user
2. Read file content
3. Validate file type and size
4. Upload to Firebase Storage at `resumes/{uid}/resume.pdf`
5. Make file publicly accessible
6. Get public URL
7. Update user profile with URL and timestamp
8. Return URL

**Response:**
```json
{
    "msg": "Resume uploaded successfully",
    "resume_url": "https://storage.googleapis.com/..."
}
```

**Error Codes:**
- `400`: Invalid file type or size
- `401`: Not authenticated
- `500`: Upload failed

**Storage Structure:**
```
Firebase Storage:
/resumes/
  /{user_id}/
    /resume.pdf
```

**Notes:**
- Overwrites previous resume (same filename)
- File is publicly accessible (consider signed URLs)
- URL stored in user profile for easy retrieval

---

### Get Resume URL

#### `GET /api/profile/resume`

Retrieves the resume URL for authenticated user.

**Authentication:** Requires session cookie

**Response:**
```json
{
    "resume_url": "https://storage.googleapis.com/..." | null,
    "msg": "No resume uploaded"  // if null
}
```

**Error Codes:**
- `401`: Not authenticated
- `404`: User not found
- `500`: Fetch failed

---

### Get Answered Questions

#### `GET /api/profile/answered-questions`

Retrieves all answered questions for user with statistics.

**Authentication:** Requires session cookie

**Process:**
1. Authenticate user
2. Fetch user profile from Firestore
3. Extract answered_questions array
4. Sort by date (most recent first)
5. Calculate statistics
6. Return data

**Response:**
```json
{
    "answered_questions": [
        {
            "questionId": "id",
            "question": "Question text",
            "answer": "User's answer",
            "score": 85,
            "feedback": "Feedback...",
            "strengths": ["strength1", "strength2"],
            "improvements": ["improvement1"],
            "date": "2025-11-24T12:00:00Z",
            "gradedBy": "gemini-ai",
            "videoMetrics": {...}  // if available
        }
    ],
    "total_answered": 10,
    "average_score": 82.5
}
```

**Statistics:**
- `total_answered`: Count of questions answered
- `average_score`: Mean of all scores, rounded to 2 decimals

**Error Codes:**
- `401`: Not authenticated
- `404`: User not found
- `500`: Fetch failed

**Sorting:**
- Questions sorted by date descending (newest first)

---

## Admin Endpoints

### Get All Users

#### `GET /api/admin/users`

Retrieves list of all users (admin only).

**Authentication:** Requires session cookie + admin privileges

**Authorization Check:**
```python
async def is_admin(uid: str) -> bool:
    """Check if user has admin privileges"""
    user_doc = db.collection("users").document(uid).get()
    return user_doc.to_dict().get("is_admin", False)
```

**Process:**
1. Authenticate user
2. Verify admin status
3. Fetch all users from Firestore
4. Filter sensitive fields
5. Return user list

**Response:**
```json
{
    "users": [
        {
            "uid": "user_id",
            "name": "User Name",
            "email": "user@example.com",
            "questions": [],
            "answered_questions": [],
            "auth_provider": "google" | "email",
            "created_at": "timestamp"
        }
    ]
}
```

**Excluded Fields:**
- `password_hash`
- `resume_url`
- Other sensitive data

**Error Codes:**
- `401`: Not authenticated
- `403`: Not an admin
- `500`: Fetch failed

**Admin Field:**
- Stored in Firestore user document
- `is_admin: true` required for access
- Must be manually set in database

---

## WebSocket Endpoints

### Practice Mode STT

#### `WebSocket /ws/practice`

Real-time speech-to-text for practice mode.

**Handler:** `practice_stt_websocket_handler` from `practice_stt_fastapi.py`

**Protocol:**
1. Client connects
2. Client sends binary audio chunks (int16 PCM, 16kHz)
3. Server buffers and processes with Whisper
4. Server sends transcription updates
5. Client displays real-time transcript

**Message Format (Server → Client):**
```json
{
    "transcript": "Current transcription...",
    "is_final": false,
    "confidence": 0.95
}
```

**Audio Format:**
- Sample rate: 16kHz
- Format: int16 PCM
- Encoding: Little-endian
- Chunk size: Variable (streamed)

**See:** `practice_stt_fastapi.py` documentation for details

---

## Matchmaking Endpoints

### Get Queue Status

#### `GET /api/matchmaking/queue-status`

Returns current matchmaking queue size and estimated wait time.

**No Authentication Required**

**Process:**
1. Query Redis for queue length
2. Calculate estimated wait time
3. Return statistics

**Response:**
```json
{
    "queue_size": 3,
    "estimated_wait_seconds": 10,
    "estimated_wait_text": "10s"
}
```

**Wait Time Algorithm:**
```python
if queue_size == 0:
    estimated_wait_seconds = 5  # Base wait
elif queue_size == 1:
    estimated_wait_seconds = 10  # Waiting for one more
else:
    estimated_wait_seconds = 3  # Match imminent
```

**Fallback:**
- Returns default values if Redis unavailable
- No error thrown for better UX

---

## Utility Functions

### Password Hashing

#### `hash_password(password: str) -> str`

Hashes password using SHA-256.

**Parameters:**
- `password`: Plain text password

**Returns:**
- Hexadecimal hash string

**Implementation:**
```python
import hashlib
return hashlib.sha256(password.encode()).hexdigest()
```

**Note:** SHA-256 is not ideal for passwords. Consider using bcrypt or argon2 in production.

---

#### `verify_password(password: str, hashed: str) -> bool`

Verifies password against hash.

**Parameters:**
- `password`: Plain text password to check
- `hashed`: Stored hash to compare against

**Returns:**
- `True` if match, `False` otherwise

**Implementation:**
```python
return hash_password(password) == hashed
```

---

### reCAPTCHA Verification

#### `verify_recaptcha(token: str) -> bool`

Verifies reCAPTCHA token with Google.

**Parameters:**
- `token`: reCAPTCHA response token from client

**Returns:**
- `True` if verification passes
- `False` if verification fails

**Process:**
1. Check if TESTING mode (bypass if enabled)
2. Validate RECAPTCHA_SECRET_KEY exists
3. POST to Google's verification API
4. Parse JSON response
5. Return success status

**API Endpoint:**
```
POST https://www.google.com/recaptcha/api/siteverify
```

**Request:**
```python
{
    "secret": RECAPTCHA_SECRET_KEY,
    "response": token
}
```

**Error Handling:**
- Returns `False` on any exception
- Logs error message for debugging
- Raises HTTPException if secret key missing

---

### Admin Check

#### `is_admin(uid: str) -> bool`

Checks if user has admin privileges.

**Parameters:**
- `uid`: User unique identifier

**Returns:**
- `True` if user is admin
- `False` if not admin or user not found

**Implementation:**
```python
user_doc = db.collection("users").document(uid).get()
if not user_doc.exists:
    return False
user_data = user_doc.to_dict()
return user_data.get("is_admin", False)
```

**Exception Handling:**
- Returns `False` on any exception
- Fails closed for security

---

## Data Models (Pydantic)

### SignupRequest
```python
class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    recaptchaToken: str
```

### LoginEmailRequest
```python
class LoginEmailRequest(BaseModel):
    email: str
    password: str
    recaptchaToken: str
```

### QuestionRequest
```python
class QuestionRequest(BaseModel):
    questionId: int
```

### SubmitAnswerRequest
```python
class SubmitAnswerRequest(BaseModel):
    questionId: str
    question: str
    answer: str
    answerCriteria: Optional[str] = None
    videoAnalytics: Optional[dict] = None
```

### UpdateProfileRequest
```python
class UpdateProfileRequest(BaseModel):
    name: str
```

### UpdatePasswordRequest
```python
class UpdatePasswordRequest(BaseModel):
    password: str
```

---

## Security Considerations

### Session Security
- Session tokens are 32-byte URL-safe random strings
- HTTP-only cookies prevent XSS attacks
- 7-day expiration reduces exposure window
- Secure flag should be True in production (HTTPS)

### Password Security
- SHA-256 hashing (consider bcrypt/argon2 upgrade)
- Minimum length enforcement
- Separate auth providers prevent confusion

### Input Validation
- All user inputs validated
- Length limits enforced
- Format validation (email, etc.)
- Type checking via Pydantic models

### reCAPTCHA Protection
- All signup/login endpoints protected
- Prevents automated attacks
- Configurable bypass for testing

### CORS Configuration
- Restricted to specific origins
- Credentials allowed for cookies
- Review for production deployment

### File Upload Security
- File type validation (PDF only)
- Size limit enforcement (10MB)
- Files stored in user-specific paths
- Consider virus scanning in production

### API Authorization
- Session-based authentication
- Admin endpoints have additional checks
- Failed authorization returns appropriate codes

---

## Performance Optimization

### Redis Caching
- Session data cached in Redis
- Reduces Firestore reads
- In-memory fallback for availability

### Async Operations
- All database operations async
- Non-blocking I/O
- FastAPI async support

### Connection Pooling
- Firebase maintains connection pool
- Redis connection reused

---

## Error Handling Best Practices

### Consistent Error Responses
```python
raise HTTPException(status_code=400, detail="Error message")
```

### Logging
```python
print(f"Error context: {e}")  # Development
# Use proper logging in production
```

### Generic Messages
- Don't leak information (e.g., "user not found")
- Use "Invalid credentials" instead

### HTTP Status Codes
- 400: Client error (bad input)
- 401: Authentication required
- 403: Forbidden (insufficient permissions)
- 404: Resource not found
- 409: Conflict (e.g., duplicate email)
- 500: Server error

---

## Testing

### Running Tests
```bash
pytest unittests/test_auth_login.py
pytest unittests/test_signup.py
pytest unittests/test_profile_edit.py
```

### Test Mode
Set `TESTING=1` environment variable to:
- Bypass reCAPTCHA verification
- Enable test-specific behavior

---

## Future Improvements

1. **Password Hashing**: Migrate from SHA-256 to bcrypt/argon2
2. **Rate Limiting**: Add rate limiting to prevent abuse
3. **Logging**: Implement structured logging (not print)
4. **Monitoring**: Add APM and error tracking
5. **File Security**: Add virus scanning for uploads
6. **Session Management**: Add session revocation list
7. **HTTPS**: Enforce HTTPS in production
8. **Input Sanitization**: Enhanced XSS prevention
9. **Database Indexing**: Optimize Firestore queries
10. **Caching**: Add more aggressive caching strategies

---

## Related Documentation

- [Authentication System](./authentication.md)
- [LLM Grading](./llm-grading.md)
- [Practice STT](./practice-stt.md)
- [API Reference](../api-reference.md)
