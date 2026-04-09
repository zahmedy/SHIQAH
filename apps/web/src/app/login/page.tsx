"use client";

import { FormEvent, useState } from "react";

import { translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const NAME_KEY = "autointel_user_name";

type VerifyResponse = {
  access_token: string;
  token_type: string;
};

type OTPRequestResponse = {
  ok: boolean;
  needs_name: boolean;
};

function normalizeUSPhone(rawPhone: string): string | null {
  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\+1\d{10}$/.test(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
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
  const normalizedPhone = normalizeUSPhone(phone);
  const text = {
    title: "Login",
    note: "Enter a U.S. mobile number, request OTP, then verify. New users will be asked for their name. MVP code is",
    missingApiBase: "NEXT_PUBLIC_API_BASE is missing.",
    invalidPhone: "Enter a valid U.S. number, for example (555) 555-0123 or +15555550123.",
    requestOtpFailed: "Failed to request OTP.",
    otpRequested: "OTP requested. For MVP, use code 0000.",
    enterName: "Enter your name.",
    phoneMustBeE164: "Phone must be a valid U.S. number.",
    enterCode: "Enter verification code.",
    verifyOtpFailed: "Failed to verify OTP.",
    phoneLabel: "Phone (U.S.)",
    nameLabel: "Name",
    yourName: "Your name",
    otpCodeLabel: "OTP Code",
    requesting: "Requesting...",
    requestOtp: "Request OTP",
    verifying: "Verifying...",
    verifyAndLogin: "Verify & Login",
    back: "Back",
  };

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApiBase);
      return;
    }
    if (!normalizedPhone) {
      setError(text.invalidPhone);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_e164: normalizedPhone }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(translateApiMessage("en", detail || `Failed with status ${res.status}`));
      }

      const data = (await res.json()) as OTPRequestResponse;
      setNeedsName(Boolean(data.needs_name));
      setStep("verify");
      setSuccess(text.otpRequested);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage("en", err.message) : text.requestOtpFailed);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApiBase);
      return;
    }
    if (needsName && !name.trim()) {
      setError(text.enterName);
      return;
    }
    if (!normalizedPhone) {
      setError(text.phoneMustBeE164);
      return;
    }
    if (!code.trim()) {
      setError(text.enterCode);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_e164: normalizedPhone,
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
      localStorage.setItem("autointel_access_token", data.access_token);
      if (name.trim()) {
        localStorage.setItem(NAME_KEY, name.trim());
      }
      window.dispatchEvent(new Event("autointel-auth-changed"));
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage("en", err.message) : text.verifyOtpFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page shell auth-wrap">
      <section className="auth-card">
        <h1>{text.title}</h1>
        <p className="auth-note">{text.note} <strong>0000</strong>.</p>

        <form onSubmit={step === "request" ? requestOtp : verifyOtp} className="filters">
          <div>
            <label className="label" htmlFor="phone">{text.phoneLabel}</label>
            <input
              id="phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(555) 555-0123"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {normalizedPhone ? <p className="helper-text">Using {normalizedPhone}</p> : null}
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
              <label className="label" htmlFor="otp">{text.otpCodeLabel}</label>
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
                {loading ? text.requesting : text.requestOtp}
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
