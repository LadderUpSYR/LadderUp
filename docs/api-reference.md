# API Reference

Complete API reference for LadderUp backend endpoints.

## Base URL

**Development**: `http://localhost:8000`
**Production**: TBD

## Authentication

Most endpoints require authentication via session cookie.

**Cookie Name**: `session_token`
**Type**: HTTP-only
**Expiration**: 7 days
**SameSite**: Lax

## Common Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid input or missing required fields |
| 401 | Unauthorized | Not authenticated or session expired |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists (e.g., duplicate email) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

## Endpoints

### Health Check

#### GET /health

Check server health status.

**Authentication**: None

**Response**:
```json
{
  "ok": true
}
```

---

### Authentication Endpoints

#### POST /api/auth/login

Login with Google OAuth.

**Request**:
```json
{
  "token": "google_oauth_id_token",
  "recaptchaToken": "recaptcha_response"
}
```

**Response** (200):
```json
{
  "user": {
    "uid": "google_user_id",
    "name": "User Name",
    "email": "user@example.com",
    "is_admin": false
  },
  "msg": "User Exists"
}
```

**Cookies Set**: `session_token`

**Errors**:
- 400: Missing token or reCAPTCHA failure
- 401: Invalid token
- 500: Server error

---

#### POST /api/auth/signup

Create new account with email/password.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "recaptchaToken": "recaptcha_response"
}
```

**Response** (200):
```json
{
  "user": {
    "uid": "generated_uuid",
    "name": "User Name",
    "email": "user@example.com"
  },
  "msg": "Account created successfully"
}
```

**Cookies Set**: `session_token`

**Errors**:
- 400: Invalid input
- 409: Email already exists
- 500: Server error

---

#### POST /api/auth/login-email

Login with email/password.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "recaptchaToken": "recaptcha_response"
}
```

**Response** (200):
```json
{
  "user": {
    "uid": "user_uuid",
    "name": "User Name",
    "email": "user@example.com",
    "is_admin": false
  },
  "msg": "Login successful"
}
```

**Cookies Set**: `session_token`

**Errors**:
- 400: Missing credentials
- 401: Invalid credentials or wrong auth provider
- 500: Server error

---

#### POST /api/auth/logout

Logout current user.

**Authentication**: Required (cookie)

**Response** (200):
```json
{
  "msg": "Successfully signed out"
}
```

**Cookies Deleted**: `session_token`

---

#### GET /api/auth/me

Get current user information.

**Authentication**: Required (cookie)

**Response** (200):
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

**Errors**:
- 401: Not authenticated or session expired

---

### Question Endpoints

#### POST /api/question/id

Get specific question by ID.

**Request**:
```json
{
  "questionId": 123
}
```

**Response** (200):
```json
{
  "answerCriteria": "Use STAR method...",
  "avgScore": 75.5,
  "numAttempts": 42,
  "question": "Tell me about a time..."
}
```

---

#### GET /api/question/random

Get random question.

**Response** (200):
```json
{
  "questionId": "doc_id",
  "answerCriteria": "Use STAR method...",
  "avgScore": 75.5,
  "numAttempts": 42,
  "question": "Tell me about a time..."
}
```

---

#### POST /api/question/submit

Submit answer for grading.

**Authentication**: Required (cookie)

**Request**:
```json
{
  "questionId": "question_id",
  "question": "Question text",
  "answer": "User's answer",
  "answerCriteria": "Grading criteria (optional)",
  "videoAnalytics": {
    "avgConfidence": 0.85,
    "eyeContactPercentage": 75,
    "neutralExpressionPercentage": 60
  }
}
```

**Response** (200):
```json
{
  "msg": "Answer submitted and graded successfully",
  "answer_record": {
    "questionId": "question_id",
    "question": "Question text",
    "answer": "User's answer",
    "score": 85.5,
    "feedback": "Great answer! You...",
    "strengths": [
      "Clear structure",
      "Specific examples"
    ],
    "improvements": [
      "Add more quantitative results"
    ],
    "date": "2025-11-24T12:00:00Z",
    "gradedBy": "gemini-ai"
  },
  "total_answered": 15,
  "grading": {
    "score": 85.5,
    "feedback": "Great answer!...",
    "strengths": ["Clear structure"],
    "improvements": ["Add more details"]
  }
}
```

**Errors**:
- 400: Missing question or answer
- 401: Not authenticated
- 500: Grading failed

---

### Profile Endpoints

#### PUT /api/profile/edit

Update user profile.

**Authentication**: Required (cookie)

**Request**:
```json
{
  "name": "New Name"
}
```

**Response** (200):
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

**Errors**:
- 400: Invalid name (too short)
- 401: Not authenticated
- 500: Update failed

---

#### PUT /api/profile/change-password

Change password (email auth only).

**Authentication**: Required (cookie)

**Request**:
```json
{
  "password": "new_password"
}
```

**Response** (200):
```json
{
  "msg": "Password updated successfully"
}
```

**Errors**:
- 400: Invalid password or OAuth account
- 401: Not authenticated
- 500: Update failed

---

#### DELETE /api/auth/delete-account

Delete user account permanently.

**Authentication**: Required (cookie)

**Response** (200):
```json
{
  "msg": "Account deleted successfully"
}
```

**Cookies Deleted**: `session_token`

**Errors**:
- 401: Not authenticated
- 500: Deletion failed

**Warning**: This action is irreversible!

---

#### POST /api/profile/upload-resume

Upload resume PDF.

**Authentication**: Required (cookie)

**Request**: Multipart form data
- `file`: PDF file (max 10MB)

**Response** (200):
```json
{
  "msg": "Resume uploaded successfully",
  "resume_url": "https://storage.googleapis.com/..."
}
```

**Errors**:
- 400: Invalid file type or size
- 401: Not authenticated
- 500: Upload failed

---

#### GET /api/profile/resume

Get resume URL.

**Authentication**: Required (cookie)

**Response** (200):
```json
{
  "resume_url": "https://storage.googleapis.com/..." | null
}
```

---

#### GET /api/profile/answered-questions

Get user's answered questions with statistics.

**Authentication**: Required (cookie)

**Response** (200):
```json
{
  "answered_questions": [
    {
      "questionId": "id",
      "question": "Question text",
      "answer": "User's answer",
      "score": 85,
      "feedback": "Feedback...",
      "strengths": ["strength1"],
      "improvements": ["improvement1"],
      "date": "2025-11-24T12:00:00Z",
      "gradedBy": "gemini-ai"
    }
  ],
  "total_answered": 10,
  "average_score": 82.5
}
```

**Errors**:
- 401: Not authenticated
- 404: User not found
- 500: Fetch failed

---

### Admin Endpoints

#### GET /api/admin/users

Get all users (admin only).

**Authentication**: Required (cookie + admin)

**Response** (200):
```json
{
  "users": [
    {
      "uid": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "questions": [],
      "answered_questions": [],
      "auth_provider": "google",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Errors**:
- 401: Not authenticated
- 403: Not an admin
- 500: Fetch failed

---

### Matchmaking Endpoints

#### GET /api/matchmaking/queue-status

Get current matchmaking queue status.

**Authentication**: None

**Response** (200):
```json
{
  "queue_size": 3,
  "estimated_wait_seconds": 10,
  "estimated_wait_text": "10s"
}
```

---

### WebSocket Endpoints

#### WebSocket /ws/practice

Practice mode speech-to-text.

**Protocol**: Binary audio → JSON responses

**Client → Server**:
- Binary audio chunks (int16 PCM, 16kHz)

**Server → Client**:

Ready message:
```json
{
  "type": "ready",
  "message": "Speech-to-text ready"
}
```

Transcription:
```json
{
  "type": "transcription",
  "text": "Transcribed text",
  "confidence": 0.95,
  "is_final": true
}
```

Error:
```json
{
  "type": "error",
  "error": "Error message"
}
```

---

## Rate Limiting

**Not Currently Implemented**

Recommended limits:
- Login attempts: 5 per minute
- API calls: 100 per minute
- File uploads: 5 per hour

## Pagination

**Not Currently Implemented**

Future endpoints should support:
```
GET /api/questions?page=1&limit=20
```

## CORS

Allowed origins:
- `http://localhost:3000`
- `http://localhost:8000`
- `http://localhost:5000`
- `http://localhost:5001`

Production: Update to production URLs

## Security Headers

Recommended additions:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

## Versioning

Current: No versioning

Future: `/api/v1/`, `/api/v2/`

## Related Documentation

- [Server API](./backend/server-api.md)
- [Architecture](./architecture-overview.md)
- [Frontend](./frontend/README.md)
