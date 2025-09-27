import "./App.css";
import LoginForm from "./components/LoginForm";
import { GoogleOAuthProvider } from "@react-oauth/google";

const API_BASE = "http://localhost:8000"; // adjust if different

function App() {
  const handleLogin = async ({ email, password, remember }) => {
    console.log("login:", { email, password, remember });
    // TODO: implement password login if desired
  };

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
      console.log("Signed in:", data);
      // TODO: store auth state, redirect, etc.
      return;
    }
    alert(`OAuth for ${provider} not implemented yet.`);
  };

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <div className="App">
        <LoginForm
          onLogin={handleLogin}
          onOAuth={handleOAuth}
          forgotHref="/forgot-password"
          title="Welcome back"
          subtitle="Sign in to continue"
        />
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
