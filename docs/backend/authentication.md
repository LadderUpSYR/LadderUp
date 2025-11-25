# Authentication System Documentation

Comprehensive documentation for LadderUp's authentication system.

## Overview

LadderUp supports two authentication methods:
1. **Google OAuth 2.0**: Social login with Google accounts
2. **Email/Password**: Traditional username/password authentication

Both methods use session-based authentication with HTTP-only cookies.

## Architecture

```
User Login → Token Verification → Create Session → 
Store in Redis → Set HTTP-only Cookie → Authenticated
```

## Authentication Flow

### Google OAuth Flow

```
1. User clicks "Sign in with Google" on frontend
   ↓
2. Google OAuth popup opens
   ↓
3. User grants permissions
   ↓
4. Frontend receives ID token
   ↓
5. Frontend sends token + reCAPTCHA to /api/auth/login
   ↓
6. Backend verifies token with Google
   ↓
7. Backend extracts user info (uid, email, name)
   ↓
8. Backend checks if user exists in Firestore
   ├─ Exists: Load profile
   └─ New: Create profile
   ↓
9. Backend generates session token
   ↓
10. Backend stores session in Redis
    ↓
11. Backend returns user data + sets cookie
    ↓
12. Frontend stores user in AuthContext
```

### Email/Password Flow

**Signup:**
```
1. User enters email, password, name
   ↓
2. Frontend gets reCAPTCHA token
   ↓
3. Frontend POSTs to /api/auth/signup
   ↓
4. Backend validates input
   ↓
5. Backend checks email uniqueness
   ↓
6. Backend generates UUID for user
   ↓
7. Backend hashes password (SHA-256)
   ↓
8. Backend creates Firestore document
   ↓
9. Backend generates session token
   ↓
10. Backend stores session in Redis
    ↓
11. Backend returns user data + sets cookie
```

**Login:**
```
1. User enters email, password
   ↓
2. Frontend gets reCAPTCHA token
   ↓
3. Frontend POSTs to /api/auth/login-email
   ↓
4. Backend finds user by email
   ↓
5. Backend verifies auth_provider is "email"
   ↓
6. Backend hashes submitted password
   ↓
7. Backend compares with stored hash
   ↓
8. Backend creates session
   ↓
9. Backend returns user data + sets cookie
```

## Session Management

### Session Token Generation

```python
import secrets

session_token = secrets.token_urlsafe(32)
# Generates 32-byte URL-safe random token
# Example: "Xj3kR9mP2qL5nV8wF1tY4uI6oP7bN0cM"
```

### Session Storage

**Primary: Redis**
```python
# Store session
await redis_client.hset(
    f"session:{token}",
    mapping={
        "uid": user_id,
        "name": user_name,
        "email": user_email,
        "expires": timestamp
    }
)
await redis_client.expire(f"session:{token}", 604800)  # 7 days
```

**Fallback: In-Memory**
```python
# If Redis unavailable
memory_sessions[token] = {
    "uid": user_id,
    "name": user_name,
    "email": user_email,
    "expires": timestamp
}
```

### Session Retrieval

```python
# Try Redis first
session = await redis_client.hgetall(f"session:{token}")

# Fallback to memory
if not session:
    session = memory_sessions.get(token)

# Check expiration
if float(session["expires"]) < now():
    delete_session(token)
    return None

return session
```

### Session Cookie

```python
response.set_cookie(
    key="session_token",
    value=token,
    httponly=True,      # Prevent JavaScript access
    secure=False,       # True in production (HTTPS only)
    samesite="lax",     # CSRF protection
    max_age=604800      # 7 days in seconds
)
```

**Security Properties:**
- **httponly**: Prevents XSS attacks (JavaScript cannot read)
- **secure**: HTTPS only (set True in production)
- **samesite**: Prevents CSRF attacks
- **max_age**: Automatic expiration

## Security Features

### reCAPTCHA Protection

All login/signup endpoints require reCAPTCHA verification.

```python
async def verify_recaptcha(token: str) -> bool:
    response = http_requests.post(
        "https://www.google.com/recaptcha/api/siteverify",
        {"secret": RECAPTCHA_SECRET_KEY, "response": token}
    )
    return response.json().get("success", False)
```

**Bypass for Testing:**
```python
if os.getenv("TESTING") == "1":
    return True  # Skip verification in tests
```

### Password Hashing

**Current Implementation:**
```python
import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()
```

**Security Note**: SHA-256 is not ideal for passwords. Consider upgrading to:

**Recommended: bcrypt**
```python
import bcrypt

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())
```

**Recommended: Argon2**
```python
from argon2 import PasswordHasher

ph = PasswordHasher()

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        ph.verify(hashed, password)
        return True
    except:
        return False
```

### Token Verification (Google OAuth)

```python
from google.oauth2 import id_token
from google.auth.transport import requests

idinfo = id_token.verify_oauth2_token(
    token,
    requests.Request(),
    GOOGLE_CLIENT_ID
)
```

**Verification Steps:**
1. Checks token signature
2. Verifies issuer (accounts.google.com)
3. Checks expiration
4. Validates audience (GOOGLE_CLIENT_ID)

### Session Expiration

**TTL: 7 days**

```python
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60  # 604800
```

**Expiration Check:**
```python
if float(session["expires"]) < datetime.now(timezone.utc).timestamp():
    await delete_session(token)
    raise HTTPException(401, "Session expired")
```

**Automatic Cleanup:**
- Redis: Automatic via TTL
- Memory: Manual check on retrieval

## Authorization

### Protected Endpoints

```python
async def protected_endpoint(request: Request):
    # Extract session token
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(401, "Not authenticated")
    
    # Verify session
    session = await get_session(session_token)
    if not session:
        raise HTTPException(401, "Invalid or expired session")
    
    # Session is valid
    uid = session["uid"]
    # ... proceed with request
```

### Admin Authorization

```python
async def is_admin(uid: str) -> bool:
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        return False
    return user_doc.to_dict().get("is_admin", False)

async def admin_endpoint(request: Request):
    # Check authentication
    session = await get_session(request.cookies.get("session_token"))
    if not session:
        raise HTTPException(401, "Not authenticated")
    
    # Check admin status
    if not await is_admin(session["uid"]):
        raise HTTPException(403, "Admin access required")
    
    # Proceed with admin action
```

## User Document Structure

### Google OAuth User

```json
{
  "uid": "google_user_id",
  "email": "user@gmail.com",
  "name": "John Doe",
  "auth_provider": "google",
  "created_at": "2025-01-15T10:30:00Z",
  "questions": [],
  "answered_questions": [],
  "is_admin": false
}
```

### Email/Password User

```json
{
  "uid": "uuid-v4-generated",
  "email": "user@example.com",
  "name": "John Doe",
  "password_hash": "sha256_hash_here",
  "auth_provider": "email",
  "created_at": "2025-01-15T10:30:00Z",
  "questions": [],
  "answered_questions": []
}
```

## Frontend Integration

### React AuthContext

```javascript
import { createContext, useContext, useState, useEffect } from "react";
import { checkAuthStatus, handleLogout } from "./utils/auth";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth on mount
  useEffect(() => {
    checkAuthStatus()
      .then(data => setUser(data?.user))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await handleLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Auth Utility Functions

```javascript
// Check current auth status
export async function checkAuthStatus() {
  const response = await fetch('/api/auth/me', {
    credentials: 'include'  // Include cookies
  });
  if (!response.ok) return null;
  return await response.json();
}

// Logout
export async function handleLogout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
}
```

### Protected Routes

```javascript
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return children;
}

// Usage
<Route path="/profile" element={
  <ProtectedRoute>
    <ProfilePage />
  </ProtectedRoute>
} />
```

## Error Handling

### Common Errors

**401 Unauthorized:**
```json
{
  "detail": "Not authenticated"
}
```

**401 Invalid Token:**
```json
{
  "detail": "Invalid token"
}
```

**401 Session Expired:**
```json
{
  "detail": "Session expired"
}
```

**400 reCAPTCHA Failed:**
```json
{
  "detail": "reCAPTCHA verification failed"
}
```

**409 Email Exists:**
```json
{
  "detail": "Email already registered"
}
```

### Frontend Error Handling

```javascript
try {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, recaptchaToken })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }
  
  const data = await response.json();
  setUser(data.user);
} catch (error) {
  setError(error.message);
}
```

## Testing

### Unit Tests

```bash
pytest unittests/test_auth_login.py
pytest unittests/test_signup.py
pytest unittests/test_userlogin.py
```

### Mock Authentication

```python
import os
os.environ["TESTING"] = "1"  # Bypass reCAPTCHA

# Mock session
from unittest.mock import AsyncMock
get_session = AsyncMock(return_value={
    "uid": "test_user",
    "name": "Test User",
    "email": "test@example.com",
    "expires": "9999999999"
})
```

## Security Best Practices

### Current Implementation

- ✅ HTTP-only cookies
- ✅ reCAPTCHA protection
- ✅ Session expiration
- ✅ CSRF protection (SameSite)
- ✅ Separate auth providers

### Recommended Improvements

- ⚠️ Upgrade password hashing (bcrypt/argon2)
- ⚠️ Enable HTTPS in production
- ⚠️ Add rate limiting
- ⚠️ Implement MFA (multi-factor authentication)
- ⚠️ Add session revocation
- ⚠️ Implement password reset
- ⚠️ Add login history tracking
- ⚠️ Implement account lockout

## Multi-Instance Considerations

### Redis Session Sharing

Redis enables session sharing across multiple server instances:

```
           Load Balancer
          /             \
    Server 1         Server 2
         \             /
          \           /
            Redis DB
```

Both servers can access same session data.

### Session Consistency

**Problem**: User updates profile name, but session still has old name.

**Solution**: Update session when profile changes:
```python
# In profile update endpoint
user_ref.update({"name": new_name})
session_data["name"] = new_name
await store_session(token, session_data)
```

## Account Deletion

When user deletes account:

```python
@app.delete("/api/auth/delete-account")
async def delete_account(request: Request):
    session_token = request.cookies.get("session_token")
    session = await get_session(session_token)
    uid = session["uid"]
    
    # Delete from Firestore
    db.collection("users").document(uid).delete()
    
    # Delete session
    await delete_session(session_token)
    
    # Delete cookie
    response.delete_cookie("session_token")
    return response
```

**Considerations:**
- Resume files not automatically deleted
- Match history may remain
- Consider soft delete instead

## Related Documentation

- [Server API](./server-api.md)
- [Database Schema](../database-schema.md)
- [API Reference](../api-reference.md)
- [Frontend Auth](../frontend/README.md#authentication-system)
