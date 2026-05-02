"use client";

import { FormEvent, useEffect, useState } from "react";

import { translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const NAME_KEY = "nicherides_user_name";

type VerifyResponse = {
  access_token: string;
  token_type: string;
};

type CodeRequestResponse = {
  ok: boolean;
  needs_name: boolean;
};

function normalizeEmail(rawEmail: string): string | null {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return null;
  }
  return email;
}

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("0000");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [needsName, setNeedsName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const normalizedEmail = normalizeEmail(email);
  const text = {
    title: "Sign in to NicheRides",
    note: "Use email to manage listings, save drafts, and contact sellers. MVP code is",
    missingApiBase: "NEXT_PUBLIC_API_BASE is missing.",
    invalidEmail: "Enter a valid email address.",
    requestCodeFailed: "Failed to request login code.",
    codeRequested: "Login code requested. For MVP, use code 0000.",
    enterName: "Enter your name.",
    enterCode: "Enter verification code.",
    verifyCodeFailed: "Failed to verify code.",
    emailLabel: "Email",
    nameLabel: "Name",
    yourName: "Your name",
    codeLabel: "Login code",
    requesting: "Requesting...",
    requestCode: "Continue with Email",
    verifying: "Verifying...",
    verifyAndLogin: "Verify & Login",
    back: "Back",
    google: "Continue with Google",
  };

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const authError = hash.get("auth_error");

    if (accessToken) {
      localStorage.setItem("nicherides_access_token", accessToken);
      window.dispatchEvent(new Event("nicherides-auth-changed"));
      window.history.replaceState(null, "", "/");
      window.location.replace("/");
      return;
    }

    if (authError) {
      setError(`Google sign-in failed: ${authError.replaceAll("_", " ")}`);
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  function startGoogleLogin() {
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApiBase);
      return;
    }

    window.location.href = `${API_BASE}/v1/auth/google/start`;
  }

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApiBase);
      return;
    }
    if (!normalizedEmail) {
      setError(text.invalidEmail);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/request-email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(translateApiMessage("en", detail || `Failed with status ${res.status}`));
      }

      const data = (await res.json()) as CodeRequestResponse;
      setNeedsName(Boolean(data.needs_name));
      setStep("verify");
      setSuccess(text.codeRequested);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage("en", err.message) : text.requestCodeFailed);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApiBase);
      return;
    }
    if (!normalizedEmail) {
      setError(text.invalidEmail);
      return;
    }
    if (needsName && !name.trim()) {
      setError(text.enterName);
      return;
    }
    if (!code.trim()) {
      setError(text.enterCode);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/verify-email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          code: code.trim(),
          name: name.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(translateApiMessage("en", detail || `Failed with status ${res.status}`));
      }

      const data = (await res.json()) as VerifyResponse;
      localStorage.setItem("nicherides_access_token", data.access_token);
      if (name.trim()) {
        localStorage.setItem(NAME_KEY, name.trim());
      }
      window.dispatchEvent(new Event("nicherides-auth-changed"));
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage("en", err.message) : text.verifyCodeFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page shell auth-wrap">
      <section className="auth-card">
        <p className="hero-kicker">Secure account access</p>
        <h1>{text.title}</h1>
        <p className="auth-note">{text.note} <strong>0000</strong>.</p>

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
        </div>

        <form onSubmit={step === "request" ? requestCode : verifyCode} className="filters">
          <div>
            <label className="label" htmlFor="email">{text.emailLabel}</label>
            <input
              id="email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {normalizedEmail ? <p className="helper-text">Using {normalizedEmail}</p> : null}
          </div>

          {needsName && (
            <div>
              <label className="label" htmlFor="name">{text.nameLabel}</label>
              <input
                id="name"
                className="input"
                placeholder={text.yourName}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {step !== "request" && (
            <div>
              <label className="label" htmlFor="login-code">{text.codeLabel}</label>
              <input
                id="login-code"
                className="input"
                inputMode="numeric"
                placeholder="0000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          )}

          <div className="auth-actions">
            {step === "request" ? (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? text.requesting : text.requestCode}
              </button>
            ) : (
              <>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? text.verifying : text.verifyAndLogin}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={loading}
                  onClick={() => {
                    setStep("request");
                    setNeedsName(false);
                    setCode("0000");
                    setSuccess("");
                    setError("");
                  }}
                >
                  {text.back}
                </button>
              </>
            )}
          </div>

          {error && <p className="notice error">{error}</p>}
          {success && <p className="notice success">{success}</p>}
        </form>
      </section>
    </main>
  );
}
