"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";
const AUTH_EVENT = "nicherides-auth-changed";

type SellCarLinkProps = {
  className?: string;
  children?: React.ReactNode;
};

export default function SellCarLink({ className = "btn btn-primary", children = "Sell A Car" }: SellCarLinkProps) {
  const [href, setHref] = useState("/login");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!API_BASE || !token) {
        if (!cancelled) setHref("/login");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          localStorage.removeItem(TOKEN_KEY);
        }
        if (!cancelled) setHref(res.ok ? "/my-cars/new" : "/login");
      } catch {
        if (!cancelled) setHref("/login");
      }
    }

    function handleAuthChange() {
      void load();
    }

    void load();
    window.addEventListener(AUTH_EVENT, handleAuthChange);
    window.addEventListener("focus", handleAuthChange);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
      window.removeEventListener("focus", handleAuthChange);
    };
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
