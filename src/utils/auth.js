/**
 * Authentication utilities for OAuth and email/password login
 */

/**
 * Handle OAuth login (currently supports Google)
 * @param {string} provider - The OAuth provider (e.g., 'google')
 * @param {string} token - The OAuth token/credential
 * @returns {Promise<{user: object}>} The user data
 */

const saveToken = (token) => {
  if (token) {
    localStorage.setItem("ws_token", token);
  }
};

export const handleOAuthLogin = async (provider, token, recaptchaToken) => {
  if (provider === "google" && token) {
    const res = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, recaptchaToken }),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Google sign-in failed");
    }
    
    const data = await res.json();
    saveToken(data.token);
    console.log("Signed in:", data.user);
    return data;
  }
  
  throw new Error(`OAuth for ${provider} not implemented yet.`);
};

/**
 * Handle email/password login
 * @param {object} credentials - Login credentials
 * @param {string} credentials.email - User email
 * @param {string} credentials.password - User password
 * @param {boolean} credentials.remember - Remember me flag (optional)
 * @returns {Promise<{user: object}>} The user data
 */
export const handleEmailLogin = async ({ email, password, remember, recaptchaToken }) => {
  console.log("login:", { email, password, remember });
  
  const res = await fetch(`/api/auth/login-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, recaptchaToken }),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login failed");
  }
  
  const data = await res.json();
  saveToken(data.token);
  console.log("Logged in:", data.user);
  return data;
};

/**
 * Handle user signup
 * @param {object} credentials - Signup credentials
 * @param {string} credentials.email - User email
 * @param {string} credentials.password - User password
 * @param {string} credentials.name - User display name
 * @returns {Promise<{user: object}>} The user data
 */
export const handleSignup = async ({ email, password, name, recaptchaToken }) => {
  console.log("signup:", { email, password, name });
  
  const res = await fetch(`/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, name, recaptchaToken }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Signup failed");
  }
  
  const data = await res.json();
  saveToken(data.token);
  console.log("Signed up:", data.user);
  return data;
};

/**
 * Handle user logout
 * @returns {Promise<void>}
 */
export const handleLogout = async ({email}) => {
  localStorage.removeItem("ws_token");
  const res = await fetch(`/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: email || "unknown" }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Logout failed");
  }
  
  return res.json();
};

/**
 * Check current authentication status
 * @returns {Promise<{user: object} | null>} The current user or null
 */
export const checkAuthStatus = async () => {
  try {
    const res = await fetch(`/api/auth/me`, {
      credentials: "include",
    });
    
    if (!res.ok) {
      return null;
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Auth check failed:", error);
    return null;
  }
};
