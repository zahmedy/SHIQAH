"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useLocale } from "@/components/LocaleProvider";
import { formatClockTime, translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";

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
  const router = useRouter();
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const text = {
    loadChatFailed: "Failed to load comments.",
    sendMessageFailed: "Failed to post.",
    loadingChat: "Loading...",
    noMessages: "No comments.",
    typeMessage: "Comment...",
    sending: "Sending...",
    send: "Post",
    user: "User",
  };

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      const messagesEl = messagesRef.current;
      if (!messagesEl) return;
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior });
    });
  }

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    setHasSession(Boolean(token));
    if (!API_BASE) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const commentsRes = await fetch(`${API_BASE}/v1/cars/${carId}/comments`, { cache: "no-store" });
        if (!commentsRes.ok) {
          throw new Error(await parseApiError(commentsRes));
        }

        const comments = (await commentsRes.json()) as Message[];
        if (token) {
          const meRes = await fetch(`${API_BASE}/v1/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.ok) {
            const me = (await meRes.json()) as MeResponse;
            setMeId(me.id);
          } else {
            setHasSession(false);
            setMeId(null);
          }
        } else {
          setMeId(null);
        }
        setMessages(comments);
        scrollToLatest("auto");
      } catch (err) {
        setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.loadChatFailed);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [carId, text.loadChatFailed]);

  const canSend = useMemo(() => !sending && (!hasSession || draft.trim().length > 0), [draft, hasSession, sending]);

  useEffect(() => {
    if (!loading && messages.length) {
      scrollToLatest();
    }
  }, [loading, messages.length]);

  async function sendMessage() {
    if (!canSend || !API_BASE) return;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setHasSession(false);
      router.push("/login");
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
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.sendMessageFailed);
    } finally {
      setSending(false);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void sendMessage();
  }

  return (
    <section className="chat-panel">
      {error && <p className="notice error">{error}</p>}
      {loading && <p className="notice">{text.loadingChat}</p>}

      {!loading && (
        <div className="chat-messages" ref={messagesRef}>
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
          ref={inputRef}
          className="input chat-input"
          placeholder={text.typeMessage}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleInputKeyDown}
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
