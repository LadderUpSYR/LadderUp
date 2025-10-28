import { useState } from "react";
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

function App() {
  const { user, setUser, loading, logout } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [showAuthForms, setShowAuthForms] = useState(false);

  const handleLogin = async (credentials) => {
    const data = await handleEmailLogin(credentials);
    setUser(data.user);
    
    // Redirect to profile page after login
    try {
      window.history.pushState({}, "", "/profile");
    } catch (e) {
      // fallback
      window.location.pathname = "/profile";
    }
  };

  const handleSignup = async (credentials) => {
    const data = await handleSignupAuth(credentials);
    setUser(data.user);
    
    // Redirect to profile page after signup
    try {
      window.history.pushState({}, "", "/profile");
    } catch (e) {
      // fallback
      window.location.pathname = "/profile";
    }
  };

  const handleOAuth = async (provider, token) => {
    const data = await handleOAuthLogin(provider, token);
    setUser(data.user);
    
    // Redirect to profile page after login
    try {
      window.history.pushState({}, "", "/profile");
    } catch (e) {
      // fallback
      window.location.pathname = "/profile";
    }
  };

  const handleSignInClick = () => {
    setShowSignup(false);
    setShowAuthForms(true);
  };

  const handleSignUpClick = () => {
    setShowSignup(true);
    setShowAuthForms(true);
  };

  if (loading) return <p>"Loading Splash Anim"</p>;

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <div className="App">
        {!user ? (
          showAuthForms ? (
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
          )
        ) : (
          // Route based on pathname
          window.location.pathname === "/profile" ? (
            <Profile user={user} />
          ) : window.location.pathname === "/question-debug" ? (
            <QuestionDebug />
          ) : window.location.pathname === "/matchmaking" ? (
            <MatchmakingLandingPage 
              onBack={() => {
                try {
                  window.history.pushState({}, '', '/profile');
                  window.location.reload();
                } catch(e) {
                  window.location.pathname = '/profile';
                }
              }}
            />
          ) : window.location.pathname.startsWith("/match/") ? (
            // Extract match ID from URL
            <MatchGameRoom 
              matchId={window.location.pathname.split("/match/")[1]}
              onExit={() => {
                try {
                  window.history.pushState({}, '', '/profile');
                  window.location.reload();
                } catch(e) {
                  window.location.pathname = '/profile';
                }
              }}
            />
          ) : window.location.pathname === "/admin" ? (
            user?.is_admin ? (
              <AdminPage />
            ) : (
              // Redirect non-admin users to profile
              window.location.replace('/profile')
            )
          ) : (
            <div className="min-h-screen w-full flex flex-col items-center justify-center">
              <p>You are logged in as {user.name}</p>
              <div className="space-x-3 mt-3">
                <button 
                  onClick={() => { 
                    try { 
                      window.history.pushState({}, '', '/profile'); 
                      window.location.reload();
                    } catch(e){ 
                      window.location.pathname = '/profile';
                    } 
                  }} 
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Go to profile
                </button>
                <button 
                  onClick={() => { 
                    try { 
                      window.history.pushState({}, '', '/matchmaking'); 
                      window.location.reload();
                    } catch(e){ 
                      window.location.pathname = '/matchmaking';
                    } 
                  }} 
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
          )
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
