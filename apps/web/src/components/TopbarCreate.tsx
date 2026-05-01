"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";

export default function TopbarCreate() {
  const [href, setHref] = useState("/login");

  useEffect(() => {
    async function load() {
      if (!API_BASE) {
        setHref("/login");
        return;
      }

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setHref("/login");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          setHref("/login");
          return;
        }
        setHref("/my-cars/new");
      } catch {
        setHref("/login");
      }
    }

    function handleAuthChange() {
      void load();
    }

    void load();
    window.addEventListener("nicherides-auth-changed", handleAuthChange);
    window.addEventListener("focus", handleAuthChange);
    return () => {
      window.removeEventListener("nicherides-auth-changed", handleAuthChange);
      window.removeEventListener("focus", handleAuthChange);
    };
  }, []);

  return (
    <Link href={href} className="btn btn-primary topbar-create-btn">
      Sell your car
    </Link>
  );
}
