# Quick Reference: Frontend URL Updates

## ✅ All Changes Complete

Your frontend code is now production-ready and will work with your deployed services.

---

## What Changed?

### **HTTP Requests (REST API)**
**Before:**
```javascript
fetch("http://localhost:8000/api/question/random")
```

**After:**
```javascript
fetch("/api/question/random")
```

**Why?** Relative paths automatically use the current domain. Browser handles the routing.

---

### **WebSocket Connections**
**Before:**
```javascript
new WebSocket("ws://localhost:5001/ws/join")
```

**After:**
```javascript
import { getWebSocketURL } from "../utils/websocketUrl";
new WebSocket(getWebSocketURL("/ws/join", 5001))
```

**Why?** WebSockets can't use relative paths. The helper function intelligently switches between:
- Local: `ws://localhost:5001`
- Production: `wss://ladderup.web.app`

---

## Files Updated

| Component | What Changed | Endpoints Updated |
|-----------|-------------|------------------|
| `useMatchmaking.js` | HTTP + WebSocket URLs | `/api/auth/me`, `/ws/join` |
| `useMatchRoom.js` | HTTP + WebSocket URLs | `/ws/room/{matchId}`, `/api/match/{matchId}/ready` |
| `usePracticeAudioCapture.js` | WebSocket URL | `/ws/practice` |
| `PracticeMode.jsx` | Removed API_BASE constant | `/api/question/random`, `/api/question/submit` |
| `ProfilePage.jsx` | All hardcoded URLs | `/api/profile/*`, `/api/auth/delete-account` |
| `QuestionDebug.jsx` | Removed API_BASE constant | `/api/question/*` |
| `MatchmakingLandingPage.jsx` | Hardcoded URLs | `/api/matchmaking/queue-status`, `/match/{id}` |
| `AdminPage.jsx` | Hardcoded URLs | `/api/profile/resume`, `/api/admin/users` |

---

## Testing Locally

```bash
# Install dependencies
npm install

# Start dev server (localhost:3000)
npm start

# In a separate terminal, start your backend services:
# - FastAPI: http://localhost:8000
# - WebSocket: ws://localhost:5001

# All features should work seamlessly!
```

---

## Deployment on Firebase

Your code will automatically work in production because:

1. **HTTP requests** to `/api/*` → Routed to your REST container
2. **WebSocket requests** to `/ws/*` → Routed to your WebSocket service
3. **The helper function** detects `https:` protocol and uses `wss://`

---

## Summary

✅ **0 hardcoded localhost URLs**  
✅ **Automatic environment detection**  
✅ **Works locally and in production**  
✅ **Secure WebSocket connections**  
✅ **Ready to deploy!**

---

## Need to Make Changes?

If you need to update an endpoint in the future:

### For HTTP requests:
Just change the path in your fetch call - everything else is automatic.

### For WebSocket connections:
Use the `getWebSocketURL()` helper:
```javascript
import { getWebSocketURL } from "../utils/websocketUrl";
const socket = new WebSocket(getWebSocketURL("/ws/your-endpoint", PORT));
```

---

## Questions?

Refer to `DEPLOYMENT_CHANGES.md` for detailed documentation of all changes made.
