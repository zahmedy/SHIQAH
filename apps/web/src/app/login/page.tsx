"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

function getSafeNextUrl() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

function getGoogleCallbackUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  return `${url.origin}${url.pathname}${url.search}`;
}

function getInitialAuthError() {
  if (typeof window === "undefined") {
    return "";
  }
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const authError = hash.get("auth_error");
  return authError ? `Google sign-in failed: ${authError.replaceAll("_", " ")}` : "";
}

export default function LoginPage() {
  const [error, setError] = useState(getInitialAuthError);
  const text = {
    title: "Sign in to NicheRides",
    note: "Use Google to manage listings, save cars, make offers, and contact sellers.",
    missingApiBase: "NEXT_PUBLIC_API_BASE is missing.",
    google: "Continue with Google",
  };

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const authError = hash.get("auth_error");

    if (accessToken) {
      const nextUrl = getSafeNextUrl();
      localStorage.setItem("nicherides_access_token", accessToken);
      window.dispatchEvent(new Event("nicherides-auth-changed"));
      window.history.replaceState(null, "", nextUrl);
      window.location.replace(nextUrl);
      return;
    }

    if (authError) {
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, []);

  function startGoogleLogin() {
    setError("");

    if (!API_BASE) {
      setError(text.missingApiBase);
      return;
    }

    window.location.href = `${API_BASE}/v1/auth/google/start?callback_url=${encodeURIComponent(getGoogleCallbackUrl())}`;
  }

  return (
    <main className="page shell auth-wrap">
      <section className="auth-card">
        <p className="hero-kicker">Secure account access</p>
        <h1>{text.title}</h1>
        <p className="auth-note">{text.note}</p>

        <div className="auth-provider-stack">
          <button type="button" className="btn btn-secondary auth-google-btn" onClick={startGoogleLogin}>
            <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.06v2.6A10 10 0 0 0 12 22z" />
              <path fill="#FBBC05" d="M6.41 13.88A6 6 0 0 1 6.09 12c0-.65.11-1.28.32-1.88v-2.6H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.48l3.35-2.6z" />
              <path fill="#EA4335" d="M12 5.99c1.47 0 2.78.5 3.82 1.5l2.87-2.87C16.95 3 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.35 2.6C7.2 7.75 9.4 5.99 12 5.99z" />
            </svg>
            {text.google}
          </button>
          {error && <p className="notice error">{error}</p>}
        </div>
      </section>
    </main>
  );
}
