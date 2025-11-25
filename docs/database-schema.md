# Database Schema

Documentation for the LadderUp database structure using Firebase Firestore.

## Overview

LadderUp uses Firebase Firestore, a NoSQL document database with collections and documents.

## Collections

### users

User profiles and account information.

**Document ID**: User UID (Google ID or generated UUID)

**Schema**:
```javascript
{
  uid: string,              // Unique user identifier
  email: string,            // User email address
  name: string,             // Display name
  auth_provider: string,    // "google" | "email"
  created_at: string,       // ISO-8601 timestamp
  
  // Email auth only
  password_hash?: string,   // SHA-256 hash (email auth only)
  
  // Optional fields
  is_admin?: boolean,       // Admin privileges
  resume_url?: string,      // Firebase Storage URL
  resume_uploaded_at?: string, // ISO-8601 timestamp
  
  // Practice history
  questions: Array,         // List of question IDs attempted
  answered_questions: Array<{
    questionId: string,
    question: string,
    answer: string,
    score: number,          // 0-100
    feedback: string,
    strengths: string[],
    improvements: string[],
    date: string,           // ISO-8601 timestamp
    gradedBy: string,       // "gemini-ai"
    videoMetrics?: {
      avgConfidence: number,
      eyeContactPercentage: number,
      neutralExpressionPercentage: number
    }
  }>
}
```

**Indexes**:
- `email` (for email lookup during login)

**Example**:
```json
{
  "uid": "abc123",
  "email": "user@example.com",
  "name": "John Doe",
  "auth_provider": "google",
  "created_at": "2025-01-15T10:30:00Z",
  "is_admin": false,
  "questions": [],
  "answered_questions": [
    {
      "questionId": "q1",
      "question": "Tell me about yourself",
      "answer": "I am a software engineer...",
      "score": 85,
      "feedback": "Great answer with clear structure",
      "strengths": ["Clear communication", "Good examples"],
      "improvements": ["Add more technical details"],
      "date": "2025-11-24T15:45:00Z",
      "gradedBy": "gemini-ai"
    }
  ]
}
```

---

### questions

Interview questions database.

**Document ID**: Auto-generated or custom ID

**Schema**:
```javascript
{
  question: string,         // Question text
  answerCriteria: string,   // Grading criteria/guidance
  avgScore: number,         // Average score across all attempts
  numAttempts: number,      // Total number of attempts
  
  // Optional metadata
  category?: string,        // "behavioral" | "technical" | etc.
  difficulty?: string,      // "easy" | "medium" | "hard"
  tags?: string[],          // ["leadership", "teamwork"]
  created_at?: string,      // ISO-8601 timestamp
  created_by?: string       // Admin UID who created it
}
```

**Indexes**:
- `category` (for filtering)
- `difficulty` (for filtering)

**Example**:
```json
{
  "question": "Tell me about a time you showed leadership",
  "answerCriteria": "Should follow STAR method. Look for specific examples, quantifiable results, and leadership qualities.",
  "avgScore": 75.5,
  "numAttempts": 142,
  "category": "behavioral",
  "difficulty": "medium",
  "tags": ["leadership", "teamwork"],
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## Redis Data Structures

Redis is used for sessions, caching, and matchmaking.

### Sessions

**Type**: Hash

**Key Format**: `session:{token}`

**TTL**: 7 days (604800 seconds)

**Fields**:
```javascript
{
  uid: string,      // User ID
  name: string,     // Display name
  email: string,    // Email address
  expires: string   // Unix timestamp
}
```

**Example**:
```
HGETALL session:abc123def456
1) "uid"
2) "user_123"
3) "name"
4) "John Doe"
5) "email"
6) "john@example.com"
7) "expires"
8) "1732550400"
```

---

### Matchmaking Queue

**Type**: List

**Key**: `match_queue`

**Values**: User IDs (strings)

**Operations**:
```
RPUSH match_queue user_123    # Add to queue
LPOP match_queue               # Get first player
LLEN match_queue               # Get queue size
LREM match_queue 0 user_123   # Remove specific user
```

---

### Match Events

**Type**: Pub/Sub Channel

**Channel**: `match_channel`

**Message Format**:
```json
{
  "players": ["user_123", "user_456"],
  "match_id": "match_user_123_user_456_1732464000"
}
```

**Operations**:
```
PUBLISH match_channel '{"players":["p1","p2"],"match_id":"m1"}'
SUBSCRIBE match_channel
```

---

## Firebase Storage

### Resume Storage

**Path Structure**:
```
/resumes/
  /{user_id}/
    /resume.pdf
```

**Example**:
```
/resumes/user_123/resume.pdf
```

**Access**: Public URLs (consider signed URLs for privacy)

**Size Limit**: 10MB per file

---

## Data Relationships

### User → Answered Questions

One-to-many embedded relationship.

```javascript
users/{uid} 
  ├─ answered_questions: [
  │    {questionId: "q1", score: 85, ...},
  │    {questionId: "q2", score: 90, ...}
  │  ]
```

### User → Questions

Many-to-many via array.

```javascript
users/{uid}
  ├─ questions: ["q1", "q2", "q3"]
  
questions/q1, questions/q2, questions/q3
```

---

## Queries

### Get User by Email

```javascript
db.collection("users")
  .where("email", "==", email)
  .limit(1)
  .get()
```

### Get Random Question

```javascript
// Get all questions
const questions = await db.collection("questions").get();

// Select random
const randomIndex = Math.floor(Math.random() * questions.size);
const question = questions.docs[randomIndex];
```

**Note**: Inefficient for large datasets. Consider using subcollections or external indexing.

### Get User's Answered Questions

```javascript
const user = await db.collection("users").doc(uid).get();
const answered = user.data().answered_questions || [];
```

---

## Data Migration

### Adding New Fields

Firestore allows flexible schemas. New fields can be added without migrating existing documents.

**Example**: Add `phone_number` field
```javascript
// New users get phone_number
// Old users: undefined until updated
```

**Best Practice**: Use default values in code
```javascript
const phoneNumber = user.phone_number || "Not provided";
```

### Renaming Fields

Requires migration script:
```javascript
const users = await db.collection("users").get();
const batch = db.batch();

users.docs.forEach(doc => {
  batch.update(doc.ref, {
    display_name: doc.data().name,  // New field
    name: firestore.FieldValue.delete()  // Remove old
  });
});

await batch.commit();
```

---

## Backup and Recovery

### Firestore Backup

```bash
gcloud firestore export gs://backup-bucket/backup-name
```

### Firestore Restore

```bash
gcloud firestore import gs://backup-bucket/backup-name
```

### Automated Backups

Set up Cloud Scheduler for daily backups.

---

## Security Rules

**Current**: Server-side security (Firebase Admin SDK)

**Recommended**: Add Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write own profile
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Questions are read-only for all
    match /questions/{questionId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;
    }
  }
}
```

---

## Performance Optimization

### Indexes

Create composite indexes for complex queries:

```
Collection: users
Fields: email (ASC), created_at (DESC)
```

### Denormalization

Store frequently accessed data redundantly:

```javascript
// Instead of joining
users/{uid} → questions/{qid}

// Store question text in answer
answered_questions: [{
  questionId: "q1",
  question: "Tell me about...",  // Denormalized
  answer: "..."
}]
```

### Caching

Cache frequently read data in Redis:
```javascript
// Cache question for 1 hour
await redis.setex(`question:${id}`, 3600, JSON.stringify(question));
```

---

## Data Consistency

### Session vs Firestore

**Issue**: Session name may differ from Firestore name if profile updated after login.

**Solution**: Update session when profile changes
```javascript
// In edit_profile endpoint
user_ref.update({"name": new_name})
session_data["name"] = new_name
await store_session(token, session_data)
```

### Answered Questions Deduplication

**Current**: Latest answer overwrites previous for same questionId

**Future**: Store complete history
```javascript
answered_questions: {
  q1: [{score: 80, date: "..."}, {score: 85, date: "..."}],
  q2: [{score: 90, date: "..."}]
}
```

---

## Scaling Considerations

### Firestore Limits

- **Document size**: 1 MB max
- **Writes**: 10,000/second (auto-scales)
- **Reads**: Unlimited

**Risk**: Users with 1000+ answered questions may hit document size limit

**Solution**: 
```javascript
// Split into subcollection
users/{uid}/answered_questions/{answerId}
```

### Redis Limits

- **Memory**: Set max memory policy
- **Connections**: Monitor connection pool

**Configuration**:
```
maxmemory 2gb
maxmemory-policy allkeys-lru
```

---

## Related Documentation

- [Server API](./backend/server-api.md)
- [Architecture](./architecture-overview.md)
- [API Reference](./api-reference.md)
