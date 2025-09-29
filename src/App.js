import { useState } from "react";
import "./App.css";
import LoginForm from "./components/LoginForm";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useAuth } from "./AuthContext";


// this is going to be moved into a seperate component just called OAuth Login

const API_BASE = "http://localhost:8000"; // adjust if different

function App() {
  const { user, setUser, loading, logout } = useAuth();

  const handleLogin = async ({ email, password, remember }) => {
    console.log("login:", { email, password, remember });
    // TODO: implement password login if desired
  };

  // checks in on browser cache if we are already logged in.
  // if we are logged in, skip sign in page


  // IMPORTANT: accept (provider, token). For Google, token is the Google ID token (JWT).
  const handleOAuth = async (provider, token) => {
    if (provider === "google" && token) {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Google sign-in failed");
      }
      const data = await res.json();
      console.log("Signed in:", data.user);



      // TODO: store auth state, redirect, etc.

      // quick setIsLoggedIn
      setUser(data.user)


      return;
    }
    alert(`OAuth for ${provider} not implemented yet.`);
  };

  if (loading) return <p>"Loading Splash Anim"</p>;

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <div className="App">
        {!user? (
        <LoginForm
          onLogin={handleLogin}
          onOAuth={handleOAuth}
          forgotHref="/forgot-password"
          title="Welcome back"
          subtitle="Sign in to continue"
        />
    ) : (
          <div className="min-h-screen w-full flex flex-col items-center justify-center">
            <p>You are logged in as {user.name}</p>
            <button onClick={logout}>Log Out</button>
          </div>
    )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
