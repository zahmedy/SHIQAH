"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export default function LeadForm({ carId }: { carId: number }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Is this still available?");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDone(false);

    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone_e164: phone,
          message,
          channel: "form",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed");
      }

      setDone(true);
      setName("");
      setPhone("");
      setMessage("Is this still available?");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        className="w-full border rounded px-3 py-2"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full border rounded px-3 py-2"
        placeholder="+9665..."
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <textarea
        className="w-full border rounded px-3 py-2"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        disabled={loading}
        className="w-full border rounded px-4 py-2"
      >
        {loading ? "Sending..." : "Send"}
      </button>

      {done && <p className="text-sm">Lead sent.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}