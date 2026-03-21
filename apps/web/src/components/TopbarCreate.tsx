"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "garaj_access_token";

export default function TopbarCreate() {
  const [href, setHref] = useState("/login");

  useEffect(() => {
    if (!API_BASE) {
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          return;
        }
        setHref("/my-cars/new");
      } catch {
        // Keep the fallback href when auth cannot be confirmed.
      }
    };

    void load();
  }, []);

  return (
    <Link href={href} className="nav-link">
      Create
    </Link>
  );
}
