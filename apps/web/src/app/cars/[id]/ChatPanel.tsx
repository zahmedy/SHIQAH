"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Message = {
  id: number;
  sender: "buyer" | "seller";
  text: string;
  timestamp: string;
};

const TOKEN_KEY = "garaj_access_token";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPanel({ carId }: { carId: number }) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 1,
      sender: "seller",
      text: "Welcome! Ask me anything about the car.",
      timestamp: formatTime(new Date()),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(Boolean(localStorage.getItem(TOKEN_KEY)));
  }, []);

  const canSend = useMemo(() => hasSession && draft.trim().length > 0, [hasSession, draft]);

  function sendMessage() {
    if (!canSend) return;
    const nextMessage: Message = {
      id: Date.now(),
      sender: "buyer",
      text: draft.trim(),
      timestamp: formatTime(new Date()),
    };
    setMessages((prev) => [...prev, nextMessage]);
    setDraft("");
  }

  return (
    <section className="chat-panel">
      <div className="chat-header">
        <div>
          <p className="chat-title">Car #{carId} Conversation</p>
          <p className="chat-subtitle">Messages stay in-app and are visible to the seller.</p>
        </div>
        {!hasSession && (
          <Link href="/login" className="btn btn-secondary chat-login">
            Login to Chat
          </Link>
        )}
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.sender === "buyer" ? "chat-buyer" : "chat-seller"}`}>
            <p>{msg.text}</p>
            <span>{msg.timestamp}</span>
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          className="input chat-input"
          placeholder={hasSession ? "Type your message..." : "Login to start chatting"}
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
          Send
        </button>
      </div>
    </section>
  );
}
