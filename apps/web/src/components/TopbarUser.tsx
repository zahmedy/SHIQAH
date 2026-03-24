"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "garaj_access_token";
const NAME_KEY = "garaj_user_name";

type MeResponse = {
  id: number;
  name: string | null;
  user_id: string | null;
  phone_e164: string;
  role: string;
  verified_at: string | null;
};

export default function TopbarUser() {
  const locale = useLocale();
  const [label, setLabel] = useState<string>("");
  const [ready, setReady] = useState(false);
  const text = locale === "ar"
    ? {
        loggedIn: "تم تسجيل الدخول",
        login: "تسجيل الدخول",
        logout: "تسجيل الخروج",
      }
    : {
        loggedIn: "Logged in",
        login: "Login",
        logout: "Logout",
      };

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
        setLabel(me.user_id ? `@${me.user_id}` : resolvedName || me.phone_e164 || text.loggedIn);
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
  }, [text.loggedIn]);

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
        {text.login}
      </Link>
    );
  }

  return (
    <>
      <Link href="/my-cars" className="user-pill" role="button">
        {label}
      </Link>
      <button type="button" className="nav-link" onClick={handleLogout}>
        {text.logout}
      </button>
    </>
  );
}
