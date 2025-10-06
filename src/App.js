import { useState } from "react";
import "./App.css";
import LoginForm from "./components/LoginForm";
import SignupForm from "./components/SignupForm";
import QuestionDebug from "./components/QuestionDebug";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useAuth } from "./AuthContext";
import { 
  handleOAuthLogin, 
  handleEmailLogin, 
  handleSignup as handleSignupAuth 
} from "./utils/auth";

function App() {
  const { user, setUser, loading, logout } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  const handleLogin = async (credentials) => {
    const data = await handleEmailLogin(credentials);
    setUser(data.user);
  };

  const handleSignup = async (credentials) => {
    const data = await handleSignupAuth(credentials);
    setUser(data.user);
  };

  const handleOAuth = async (provider, token) => {
    const data = await handleOAuthLogin(provider, token);
    setUser(data.user);
  };

  if (loading) return <p>"Loading Splash Anim"</p>;

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <div className="App">
        {!user ? (
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
          <QuestionDebug />
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
