"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";

type UnreadCountResponse = {
  unread_count: number;
};

export default function TopbarNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasSession, setHasSession] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    const token = window.localStorage.getItem(TOKEN_KEY) || "";
    setHasSession(Boolean(token));
    if (!API_BASE || !token) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/v1/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        setUnreadCount(0);
        return;
      }
      const data = (await res.json()) as UnreadCountResponse;
      setUnreadCount(data.unread_count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => void loadUnreadCount(), 0);
    const intervalId = window.setInterval(loadUnreadCount, 15000);
    function handleVisibilityChange() {
      if (!document.hidden) {
        void loadUnreadCount();
      }
    }

    window.addEventListener("nicherides-auth-changed", loadUnreadCount);
    window.addEventListener("nicherides-notifications-changed", loadUnreadCount);
    window.addEventListener("focus", loadUnreadCount);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      window.removeEventListener("nicherides-auth-changed", loadUnreadCount);
      window.removeEventListener("nicherides-notifications-changed", loadUnreadCount);
      window.removeEventListener("focus", loadUnreadCount);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadUnreadCount]);

  if (!hasSession) {
    return null;
  }

  return (
    <Link
      href="/notifications"
      className={`notification-pill${unreadCount > 0 ? " notification-pill-unread" : ""}`}
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="notification-icon">
        <path d="M15 17H9m9-2V10a6 6 0 0 0-12 0v5l-2 2h16l-2-2Zm-4 4a2 2 0 0 1-4 0" />
      </svg>
      {unreadCount > 0 ? <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
    </Link>
  );
}
