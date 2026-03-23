"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "garaj_access_token";
const NAME_KEY = "garaj_user_name";

type MeResponse = {
  id: number;
  name: string | null;
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
      const fallbackName = localStorage.getItem(NAME_KEY) || "";
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
          setLabel(fallbackName);
          setReady(true);
          return;
        }
        const me = (await res.json()) as MeResponse;
        let resolvedName = me.name || fallbackName;
        if (!me.name && fallbackName) {
          const patchRes = await fetch(`${API_BASE}/v1/me`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: fallbackName }),
          });
          if (patchRes.ok) {
            const updatedMe = (await patchRes.json()) as MeResponse;
            resolvedName = updatedMe.name || fallbackName;
          }
        }
        if (resolvedName) {
          localStorage.setItem(NAME_KEY, resolvedName);
        }
        setLabel(resolvedName || me.phone_e164 || "Logged in");
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
    localStorage.removeItem(NAME_KEY);
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
