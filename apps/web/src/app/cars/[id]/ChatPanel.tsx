"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useLocale } from "@/components/LocaleProvider";
import { formatClockTime, translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "autointel_access_token";

type Message = {
  id: number;
  car_id: number;
  sender_user_id: number;
  sender_public_user_id: string | null;
  message: string;
  created_at: string;
};

type MeResponse = {
  id: number;
};

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return translateApiMessage("en", detail || `Failed with status ${res.status}`);
}

export default function ChatPanel({ carId }: { carId: number }) {
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const text = {
    loadChatFailed: "Failed to load comments.",
    sendMessageFailed: "Failed to post comment.",
    loginToChat: "Login to Comment",
    loadingChat: "Loading comments...",
    noMessages: "No comments yet.",
    typeMessage: "Write your comment...",
    loginToStart: "Login to start commenting",
    sending: "Sending...",
    send: "Add Comment",
    user: "User",
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    setHasSession(Boolean(token));
    if (!token || !API_BASE) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [meRes, commentsRes] = await Promise.all([
          fetch(`${API_BASE}/v1/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/v1/cars/${carId}/comments`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }),
        ]);

        if (!meRes.ok) {
          throw new Error(await parseApiError(meRes));
        }
        if (!commentsRes.ok) {
          throw new Error(await parseApiError(commentsRes));
        }

        const me = (await meRes.json()) as MeResponse;
        const comments = (await commentsRes.json()) as Message[];
        setMeId(me.id);
        setMessages(comments);
      } catch (err) {
        setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.loadChatFailed);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [carId, text.loadChatFailed]);

  const canSend = useMemo(() => hasSession && draft.trim().length > 0 && !sending, [hasSession, draft, sending]);

  async function sendMessage() {
    if (!canSend || !API_BASE) return;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setHasSession(false);
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: draft.trim() }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const created = (await res.json()) as Message;
      setMessages((prev) => [...prev, created]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.sendMessageFailed);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-panel">
      {!hasSession && (
        <div className="chat-header">
          <Link href="/login" className="btn btn-secondary chat-login">
            {text.loginToChat}
          </Link>
        </div>
      )}

      {error && <p className="notice error">{error}</p>}
      {loading && <p className="notice">{text.loadingChat}</p>}

      {!loading && (
        <div className="chat-messages">
          {messages.length === 0 ? (
            <p className="car-meta">{text.noMessages}</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble ${msg.sender_user_id === meId ? "chat-buyer" : "chat-seller"}`}
              >
                <p>{msg.message}</p>
                <span>
                  {msg.sender_public_user_id ? `@${msg.sender_public_user_id}` : `${text.user} ${msg.sender_user_id}`} · {formatClockTime(msg.created_at, locale)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="chat-input-row">
        <input
          className="input chat-input"
          placeholder={hasSession ? text.typeMessage : text.loginToStart}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!hasSession}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={sendMessage}
          disabled={!canSend}
        >
          {sending ? text.sending : text.send}
        </button>
      </div>
    </section>
  );
}
