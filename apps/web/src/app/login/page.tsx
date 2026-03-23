"use client";

import { FormEvent, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const NAME_KEY = "garaj_user_name";

type VerifyResponse = {
  access_token: string;
  token_type: string;
};

type OTPRequestResponse = {
  ok: boolean;
  needs_name: boolean;
};

function looksLikeE164(phone: string): boolean {
  return /^\+\d{8,15}$/.test(phone.trim());
}

export default function LoginPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("0000");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [needsName, setNeedsName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }
    if (!looksLikeE164(phone)) {
      setError("Enter phone in E.164 format, e.g. +9665XXXXXXXX.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_e164: phone.trim() }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Failed with status ${res.status}`);
      }

      const data = (await res.json()) as OTPRequestResponse;
      setNeedsName(Boolean(data.needs_name));
      setStep("verify");
      setSuccess("OTP requested. For MVP, use code 0000.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }
    if (needsName && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!looksLikeE164(phone)) {
      setError("Phone must be E.164 format.");
      return;
    }
    if (!code.trim()) {
      setError("Enter verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_e164: phone.trim(),
          code: code.trim(),
          name: name.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(detail || `Failed with status ${res.status}`);
      }

      const data = (await res.json()) as VerifyResponse;
      localStorage.setItem("garaj_access_token", data.access_token);
      if (name.trim()) {
        localStorage.setItem(NAME_KEY, name.trim());
      }
      window.dispatchEvent(new Event("garaj-auth-changed"));
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page shell auth-wrap">
      <section className="auth-card">
        <h1>Login</h1>
        <p className="auth-note">
          Enter your phone number, request OTP, then verify. New users will be asked for their name. MVP code is <strong>0000</strong>.
        </p>

        <form onSubmit={step === "request" ? requestOtp : verifyOtp} className="filters">
          <div>
            <label className="label" htmlFor="phone">Phone (E.164)</label>
            <input
              id="phone"
              className="input"
              placeholder="+9665XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {needsName && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input
                id="name"
                className="input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {step !== "request" && (
            <div>
              <label className="label" htmlFor="otp">OTP Code</label>
              <input
                id="otp"
                className="input"
                placeholder="0000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          )}

          <div className="auth-actions">
            {step === "request" ? (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Requesting..." : "Request OTP"}
              </button>
            ) : (
              <>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Login"}
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
                  Back
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
