# Frontend Documentation

The LadderUp frontend is a React-based single-page application providing the user interface for interview practice.

## Overview

A modern React application with:
- Component-based architecture
- Context API for state management
- Custom hooks for reusable logic
- Dark mode support
- Responsive design with Tailwind CSS

## Tech Stack

- **Framework**: React 18
- **Styling**: Tailwind CSS
- **State Management**: Context API
- **Routing**: React Router (inferred)
- **Build Tool**: Create React App
- **API Communication**: Fetch API

## File Structure

```
src/
├── App.js                 # Main application component
├── App.css               # Global styles
├── index.js              # React entry point
├── AuthContext.js        # Authentication state management
├── components/
│   ├── LandingPage.jsx           # Homepage/login
│   ├── LoginForm.jsx             # Login form
│   ├── SignupForm.jsx            # Signup form
│   ├── ProfilePage.jsx           # User dashboard
│   ├── PracticeMode.jsx          # Solo practice
│   ├── MatchmakingPage.jsx       # Matchmaking UI
│   ├── MatchmakingLandingPage.jsx # Match lobby
│   ├── MatchGameRoom.jsx         # Active match room
│   ├── AdminPage.jsx             # Admin panel
│   ├── FaceTrackingPage.jsx      # Video analytics
│   ├── QuestionDebug.jsx         # Dev tools
│   ├── useMatchmaking.js         # Matchmaking hook
│   ├── useMatchRoom.js           # Match room hook
│   ├── useAudioCapture.js        # Audio recording
│   ├── usePracticeAudioCapture.js # Practice audio
│   └── usePracticeVideoCapture.js # Practice video
└── utils/
    ├── auth.js            # Auth utilities
    ├── firebase.js        # Firebase config
    └── useDarkMode.js     # Dark mode hook
```

## Core Components

### App.js

Main application component with routing and authentication.

**Responsibilities:**
- Route configuration
- Protected route handling
- Layout structure
- Authentication check

### LandingPage.jsx

Homepage with authentication options.

**Features:**
- Hero section
- Login/Signup forms
- Google OAuth integration
- reCAPTCHA verification

### ProfilePage.jsx

User dashboard and profile management.

**Features:**
- Profile editing
- Password change
- Resume upload
- Practice history
- Statistics display
- Navigation to practice/matchmaking

### PracticeMode.jsx

Solo practice interface with AI grading.

**Features:**
- Text mode: Type answers
- Video mode: Record video/audio responses
- Real-time speech-to-text
- Video analytics (face tracking, eye contact)
- AI feedback display
- Question history
- Dark mode toggle

**Modes:**
1. **Text Mode**: Simple text input and submission
2. **Video Mode**: Camera + microphone recording with analytics

### MatchmakingPage.jsx

Simple matchmaking interface.

**Features:**
- Join/leave queue
- Queue status display
- Partner notification
- WebSocket connection

### MatchGameRoom.jsx

Active match session interface.

**Features:**
- Peer video/audio
- Question display
- Answer submission
- Timer
- Scoring

### AdminPage.jsx

Administrative panel for user management.

**Features:**
- User listing
- Analytics viewing
- Question management (planned)

## Authentication System

### AuthContext.js

Global authentication state using React Context.

```javascript
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Check auth status on mount
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

**Usage:**
```javascript
import { useAuth } from '../AuthContext';

function MyComponent() {
  const { user, loading, logout } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please login</div>;
  
  return <div>Hello {user.name}</div>;
}
```

### auth.js Utilities

**Functions:**
```javascript
// Check current auth status
async checkAuthStatus()

// Logout user
async handleLogout()

// Login with Google
async loginWithGoogle(token, recaptchaToken)

// Login with email
async loginWithEmail(email, password, recaptchaToken)

// Signup with email
async signupWithEmail(email, password, name, recaptchaToken)
```

## Custom Hooks

### useMatchmaking.js

Manages matchmaking state and WebSocket connection.

```javascript
export function useMatchmaking() {
  const [status, setStatus] = useState("idle");
  const [partners, setPartners] = useState([]);
  
  const joinQueue = () => {
    // Connect to WebSocket
    // Send join message
  };
  
  const leaveQueue = () => {
    // Send leave message
    // Disconnect
  };
  
  return { status, partners, joinQueue, leaveQueue };
}
```

**States:**
- `idle`: Not in queue
- `connecting`: Establishing connection
- `queued`: Waiting for match
- `matched`: Match found
- `disconnected`: Connection lost

### useMatchRoom.js

Manages active match room state.

**Features:**
- Question management
- Answer submission
- Peer connection
- Timer management

### usePracticeAudioCapture.js

Handles audio recording for practice mode.

**Features:**
- Microphone access
- Audio streaming
- WebSocket communication for STT
- Transcript display

### usePracticeVideoCapture.js

Handles video recording and analytics.

**Features:**
- Camera access
- Face detection
- Eye contact tracking
- Expression analysis
- Video recording

### useDarkMode.js

Manages dark mode state with persistence.

```javascript
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  
  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('darkMode', newValue);
      return newValue;
    });
  };
  
  return { isDarkMode, toggleDarkMode };
}
```

## Styling

### Tailwind CSS

Utility-first CSS framework for rapid UI development.

**Configuration:** `tailwind.config.js`

**Common Patterns:**
```jsx
// Dark mode conditional
className={`${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}

// Responsive design
className="px-4 sm:px-6 lg:px-8"

// Transitions
className="transition-colors duration-500"
```

### Custom Styles

**App.css**: Global styles and custom animations

## API Communication

### Base URL

```javascript
const API_BASE = "http://localhost:8000";
```

**Production**: Update to production URL

### Fetch Pattern

```javascript
const response = await fetch(`${API_BASE}/api/endpoint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',  // Include cookies
  body: JSON.stringify(data)
});

if (!response.ok) {
  throw new Error('Request failed');
}

const result = await response.json();
```

### Error Handling

```javascript
try {
  const data = await fetchData();
  // Handle success
} catch (error) {
  console.error('Error:', error);
  // Show error to user
  setError(error.message);
}
```

## State Management

### Local Component State

```javascript
const [value, setValue] = useState(initialValue);
```

### Global State (Context)

- **AuthContext**: User authentication
- **Future**: Theme context, notification context

### URL State (Router)

```javascript
const { id } = useParams();  // Get route params
const navigate = useNavigate();  // Programmatic navigation
```

## WebSocket Integration

### Practice Mode STT

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/practice');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'transcription') {
    setTranscript(prev => prev + ' ' + data.text);
  }
};

// Send audio
ws.send(audioData);
```

### Matchmaking

```javascript
const ws = new WebSocket('ws://localhost:5001/join');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'match_found') {
    navigate(`/match/${data.match_id}`);
  }
};
```

## Video Analytics

### Face Tracking

Uses TensorFlow.js and face-detection models.

**Metrics Tracked:**
- Face detection confidence
- Eye contact percentage
- Expression analysis (neutral, happy, etc.)
- Head position

**Implementation:**
```javascript
// Load face detection model
const model = await faceLandmarksDetection.load(...);

// Detect faces in video frame
const predictions = await model.estimateFaces(video);

// Calculate metrics
const eyeContact = calculateEyeContact(predictions);
const confidence = predictions[0]?.faceInViewConfidence || 0;
```

## Performance Optimization

### Code Splitting

```javascript
const LazyComponent = React.lazy(() => import('./Component'));

<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>
```

### Memoization

```javascript
const memoizedValue = useMemo(() => computeExpensive(a, b), [a, b]);
const memoizedCallback = useCallback(() => doSomething(a), [a]);
```

### Debouncing

```javascript
const debouncedSearch = useMemo(
  () => debounce((query) => performSearch(query), 300),
  []
);
```

## Accessibility

### Semantic HTML

```jsx
<nav>...</nav>
<main>...</main>
<button>Click Me</button>  // Not <div onClick>
```

### ARIA Labels

```jsx
<button aria-label="Close modal" onClick={close}>
  ✕
</button>
```

### Keyboard Navigation

```javascript
onKeyDown={(e) => {
  if (e.key === 'Enter') handleSubmit();
}}
```

## Testing

### Component Tests

```bash
npm test
```

### E2E Tests (Future)

```bash
npm run test:e2e
```

## Development

### Running Locally

```bash
npm install
npm start
```

Runs on `http://localhost:3000`

### Building for Production

```bash
npm run build
```

Outputs to `build/` directory

### Environment Variables

Create `.env`:
```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=your_client_id
REACT_APP_RECAPTCHA_SITE_KEY=your_site_key
```

## Common Issues

### CORS Errors

Ensure backend allows origin:
```python
allow_origins=["http://localhost:3000"]
```

### Cookie Not Sent

Ensure `credentials: 'include'` in fetch:
```javascript
credentials: 'include'
```

### WebSocket Connection Failed

Check WebSocket URL and server running.

## Future Enhancements

1. **Offline Support**: Service workers, PWA
2. **Real-time Collaboration**: Shared whiteboards
3. **Mobile App**: React Native version
4. **Internationalization**: Multi-language support
5. **Accessibility**: Screen reader optimization
6. **Performance**: Virtual scrolling for long lists

## Related Documentation

- [Server API](../backend/server-api.md)
- [Authentication](../backend/authentication.md)
- [Architecture](../architecture-overview.md)
