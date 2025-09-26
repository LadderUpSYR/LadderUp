// src/App.js
import './App.css';
import LoginForm from './components/LoginForm';

function App() {
  const handleLogin = async ({ email, password, remember }) => {
    // TODO: call your backend here
    console.log('login:', { email, password, remember });
  };

  const handleOAuth = async (provider) => {
    // TODO: start your OAuth flow here
    console.log('oauth provider:', provider);
  };

  return (
    <div className="App">
      <LoginForm
        onLogin={handleLogin}
        onOAuth={handleOAuth}
        forgotHref="/forgot-password"   // optional
        title="Welcome back"
        subtitle="Sign in to continue"
      />
    </div>
  );
}

export default App;
