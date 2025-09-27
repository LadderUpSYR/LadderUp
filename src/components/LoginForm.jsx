import React, { useState } from "react";
import { motion } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";

/**
 * Props
 *  - onLogin?: ({ email, password, remember }) => Promise<void> | void
 *  - onOAuth?: (provider: string, token?: string) => Promise<void> | void
 *  - providers?: Array<{ id: string; label: string }>
 *  - title?: string
 *  - subtitle?: string
 *  - forgotHref?: string
 *  - disableRemember?: boolean
 */

export default function LoginForm({
  onLogin,
  onOAuth,
  providers = [{ id: "google", label: "Continue with Google" }], // ✅ restore default
  title = "Welcome back",
  subtitle = "Sign in to your account",
  forgotHref,
  disableRemember,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailValid = (v) => /.+@.+\..+/.test(v);
  const pwValid = (v) => v.length >= 6;

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    if (!emailValid(email)) return setError("Please enter a valid email address.");
    if (!pwValid(password)) return setError("Password must be at least 6 characters.");

    try {
      setLoading(true);
      await onLogin?.({ email, password, remember });
    } catch (err) {
      setError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="bg-white shadow-xl shadow-slate-200/60 rounded-2xl p-6 sm:p-8 border border-slate-100">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="text-slate-500 mt-1">{subtitle}</p>
          </div>

          {/* OAuth buttons (single block) */}
          {!!providers?.length && (
            <div className="space-y-3">
              {providers.map((p) => {
                if (p.id === "google") {
                  return (
                    <GoogleLogin
                      key="google"
                      onSuccess={(cred) => {
                        const token = cred?.credential; // Google ID token (JWT)
                        if (token) onOAuth?.("google", token);
                      }}
                      onError={() => {
                        setError("Google sign-in failed.");
                      }}
                      useOneTap={false}
                      theme="outline"
                      shape="pill"
                      text="signin_with"
                    />
                  );
                }

                // Generic button for other providers (placeholder)
                return (
                  <button
                    key={p.id}
                    onClick={() => onOAuth?.(p.id)}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                      <circle cx="12" cy="12" r="10" fill="currentColor" />
                    </svg>
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {!!providers?.length && (
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-xs text-slate-400">or continue with email</span>
              </div>
            </div>
          )}

          {/* Email/password form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                {forgotHref && (
                  <a href={forgotHref} className="text-xs text-slate-500 hover:text-slate-700">
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-700"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    // eye-off (outline)
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 15.254 6.3 17.75 10.5 17.95" />
                      <path d="M20.489 15.232A10.45 10.45 0 0022.066 12C20.773 8.746 17.71 6.25 13.5 6.05" />
                      <path d="M9.88 9.88a3 3 0 104.24 4.24" />
                      <path d="M3 3l18 18" />
                    </svg>
                  ) : (
                    // eye (outline)
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2.036 12.322a1.01 1.01 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .638C20.573 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {!disableRemember && (
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-400/50"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          By continuing you agree to our <a className="underline hover:text-slate-700" href="#">Terms</a> and <a className="underline hover:text-slate-700" href="#">Privacy Policy</a>.
        </p>
      </motion.div>
    </div>
  );
}
