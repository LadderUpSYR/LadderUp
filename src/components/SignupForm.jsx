import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import ReCAPTCHA from "react-google-recaptcha";

/**
 * SignupForm Component
 * Props:
 *  - onSignup: ({ email, password, name }) => Promise<void> | void
 *  - onSwitchToLogin?: () => void
 *  - title?: string
 *  - subtitle?: string
 */

export default function SignupForm({
  onSignup,
  onSwitchToLogin,
  title = "Create your account",
  subtitle = "Sign up to get started",
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const recaptchaRef = useRef();

  const emailValid = (v) => /.+@.+\..+/.test(v);
  const pwValid = (v) => v.length >= 6;
  const nameValid = (v) => v.trim().length >= 2;

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!nameValid(name)) {
      return setError("Name must be at least 2 characters long.");
    }
    if (!emailValid(email)) {
      return setError("Please enter a valid email address.");
    }
    if (!pwValid(password)) {
      return setError("Password must be at least 6 characters.");
    }
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    const recaptchaToken = recaptchaRef.current.getValue();
    if (!recaptchaToken) return setError("Please complete the reCAPTCHA challenge.");
    recaptchaRef.current.reset();

    try {
      setLoading(true);
      await onSignup?.({ email, password, name, recaptchaToken });
      setSuccess("Account created successfully! Redirecting...");
      // Clear form
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.message || "Sign-up failed. Please try again.");
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

          {/* Signup form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                disabled={loading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                placeholder="John Doe"
                required
              />
            </div>

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
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
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
              <p className="text-xs text-slate-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          {/* Switch to login */}
          {onSwitchToLogin && (
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Already have an account?{" "}
                <button
                  onClick={onSwitchToLogin}
                  className="font-medium text-slate-900 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          By signing up you agree to our{" "}
          <a className="underline hover:text-slate-700" href="#">
            Terms
          </a>{" "}
          and{" "}
          <a className="underline hover:text-slate-700" href="#">
            Privacy Policy
          </a>
          .
        </p>
      </motion.div>
    </div>
  );
}
