import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams} from "react-router-dom";
import "./App.css";
import LoginForm from "./components/LoginForm";
import SignupForm from "./components/SignupForm";
import QuestionDebug from "./components/QuestionDebug";
import Profile from "./components/ProfilePage";
import LandingPage from "./components/LandingPage";
import MatchmakingLandingPage from "./components/MatchmakingLandingPage";
import AdminPage from "./components/AdminPage";
import MatchGameRoom from "./components/MatchGameRoom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useAuth } from "./AuthContext";
import MatchmakingPage from "./components/MatchmakingPage";
import { 
  handleOAuthLogin, 
  handleEmailLogin, 
  handleSignup as handleSignupAuth 
} from "./utils/auth";

function AuthWrapper() {
  const { user } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [showAuthForms, setShowAuthForms] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleLogin = async (credentials) => {
    const data = await handleEmailLogin(credentials);
    setUser(data.user);
    navigate("/profile");
  };

  const handleSignup = async (credentials) => {
    const data = await handleSignupAuth(credentials);
    setUser(data.user);
    navigate("/profile");
  };

  const handleOAuth = async (provider, token) => {
    const data = await handleOAuthLogin(provider, token);
    setUser(data.user);
    navigate("/profile");
  };

  const handleSignInClick = () => {
    setShowSignup(false);
    setShowAuthForms(true);
  };

  const handleSignUpClick = () => {
    setShowSignup(true);
    setShowAuthForms(true);
  };

  if (user) {
    return <Navigate to="/profile" replace />;
  }

  return showAuthForms ? (
    showSignup ? (
      <SignupForm
        onSignup={handleSignup}
        onSwitchToLogin={() => setShowSignup(false)}
        title="Create your account"
        subtitle="Sign up to get started"
      />
    ) : (
      <LoginForm
        onLogin={handleLogin}
        onOAuth={handleOAuth}
        onSwitchToSignup={() => setShowSignup(true)}
        forgotHref="/forgot-password"
        title="Welcome back"
        subtitle="Sign in to continue"
      />
    )
  ) : (
    <LandingPage 
      onSignIn={handleSignInClick}
      onSignUp={handleSignUpClick}
    />
  );
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !user.is_admin) {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

function DefaultLoggedInPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center">
      <p>You are logged in as {user.name}</p>
      <div className="space-x-3 mt-3">
        <button 
          onClick={() => navigate('/profile')} 
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          Go to profile
        </button>
        <button 
          onClick={() => navigate('/matchmaking')} 
          className="px-3 py-1 bg-green-600 text-white rounded"
        >
          Matchmaking
        </button>
        <button onClick={logout} className="px-3 py-1 bg-gray-200 rounded">Log Out</button>
      </div>
      <div className="mt-6 w-full max-w-md">
        <MatchmakingPage />
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<AuthWrapper />} />
      
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <Profile user={user} />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/question-debug" 
        element={
          <ProtectedRoute>
            <QuestionDebug />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/matchmaking" 
        element={
          <ProtectedRoute>
            <MatchmakingLandingPage onBack={() => navigate('/profile')} />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/match/:matchId" 
        element={
          <ProtectedRoute>
            <MatchGameRoomWrapper />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/home" 
        element={
          <ProtectedRoute>
            <DefaultLoggedInPage />
          </ProtectedRoute>
        } 
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function MatchGameRoomWrapper() {
  const navigate = useNavigate();
  const { matchId } = useParams();
  
  return (
    <MatchGameRoom 
      matchId={matchId}
      onExit={() => navigate('/profile')}
    />
  );
}

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-sky-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-sky-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-xl font-bold text-sky-600">LadderUp</h2>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <div className="App">
          <AppRoutes />
        </div>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;