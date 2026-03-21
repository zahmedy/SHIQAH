"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "garaj_access_token";

type MeResponse = {
  id: number;
  phone_e164: string;
  role: string;
  verified_at: string | null;
};

export default function TopbarUser() {
  const [label, setLabel] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      if (!API_BASE) {
        setLabel("");
        setReady(true);
        return;
      }

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setLabel("");
        setReady(true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          setLabel("");
          setReady(true);
          return;
        }
        const me = (await res.json()) as MeResponse;
        setLabel(me.phone_e164 || "Logged in");
      } finally {
        setReady(true);
      }
    }

    function handleAuthChange() {
      setReady(false);
      void load();
    }

    void load();
    window.addEventListener("garaj-auth-changed", handleAuthChange);
    window.addEventListener("focus", handleAuthChange);
    return () => {
      window.removeEventListener("garaj-auth-changed", handleAuthChange);
      window.removeEventListener("focus", handleAuthChange);
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setLabel("");
    setReady(true);
    window.dispatchEvent(new Event("garaj-auth-changed"));
    window.location.replace("/");
  }

  if (!ready) return null;

  if (!label) {
    return (
      <Link href="/login" className="nav-link">
        Login
      </Link>
    );
  }

  return (
    <>
      <Link href="/my-cars" className="user-pill" role="button">
        {label}
      </Link>
      <button type="button" className="nav-link" onClick={handleLogout}>
        Logout
      </button>
    </>
  );
}
