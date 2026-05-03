"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatDateTime } from "@/lib/locale";
import { useLocale } from "@/components/LocaleProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";

type NotificationItem = {
  id: number;
  user_id: number;
  actor_user_id: number | null;
  car_id: number | null;
  type: string;
  title: string;
  body: string;
  metadata_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function notificationHref(notification: NotificationItem) {
  return notification.car_id ? `/cars/${notification.car_id}` : "/notifications";
}

export default function NotificationsPage() {
  const locale = useLocale();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");

  const loadNotifications = useCallback(async (nextToken = token) => {
    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      setLoading(false);
      return;
    }
    if (!nextToken) {
      setError("Login is required to view notifications.");
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/notifications`, {
        headers: { Authorization: `Bearer ${nextToken}` },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Failed to load notifications.");
      }
      const data = (await res.json()) as NotificationItem[];
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const nextToken = window.localStorage.getItem(TOKEN_KEY) || "";
    setToken(nextToken);
    void loadNotifications(nextToken);
  }, [loadNotifications]);

  async function markRead(notificationId: number) {
    if (!API_BASE || !token) {
      return;
    }
    const res = await fetch(`${API_BASE}/v1/notifications/${notificationId}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, read_at: new Date().toISOString() } : notification,
        ),
      );
      window.dispatchEvent(new Event("nicherides-notifications-changed"));
    }
  }

  async function markAllRead() {
    if (!API_BASE || !token) {
      return;
    }
    const res = await fetch(`${API_BASE}/v1/notifications/read-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const now = new Date().toISOString();
      setNotifications((current) => current.map((notification) => ({ ...notification, read_at: notification.read_at || now })));
      window.dispatchEvent(new Event("nicherides-notifications-changed"));
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <main className="page shell">
      <section className="panel notifications-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Account</p>
            <h1 className="section-title">Notifications</h1>
          </div>
          {unreadCount ? (
            <button type="button" className="btn btn-secondary" onClick={() => void markAllRead()}>
              Mark all read
            </button>
          ) : null}
        </div>

        {loading ? <p className="helper-text spaced-top-sm">Loading notifications...</p> : null}
        {error ? <p className="notice error spaced-top-sm">{error}</p> : null}

        {!loading && !error && notifications.length === 0 ? (
          <p className="helper-text spaced-top-sm">No notifications yet.</p>
        ) : null}

        {notifications.length ? (
          <div className="notification-list spaced-top-sm">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`notification-card${notification.read_at ? "" : " notification-card-unread"}`}
              >
                <Link
                  href={notificationHref(notification)}
                  className="notification-card-link"
                  onClick={() => {
                    if (!notification.read_at) {
                      void markRead(notification.id);
                    }
                  }}
                >
                  <div>
                    <p className="notification-card-title">{notification.title}</p>
                    <p className="notification-card-body">{notification.body}</p>
                  </div>
                  <p className="notification-card-time">{formatDateTime(notification.created_at, locale)}</p>
                </Link>
                {!notification.read_at ? (
                  <button type="button" className="notification-read-button" onClick={() => void markRead(notification.id)}>
                    Mark read
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
