"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

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

    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      setLoading(false);
      return;
    }

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
        const contentType = res.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await res.json() : await res.text();
        const detail = typeof payload === "string" ? payload : payload?.detail;
        throw new Error(detail || `Failed with status ${res.status}`);
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
    <form onSubmit={onSubmit} className="filters">
      <div>
        <label className="label" htmlFor="lead-name">Name</label>
        <input
          id="lead-name"
          className="input"
          placeholder="Ahmed"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="lead-phone">Phone</label>
        <input
          id="lead-phone"
          className="input"
          placeholder="+9665..."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="lead-message">Message</label>
        <textarea
          id="lead-message"
          className="textarea"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <button disabled={loading} className="btn btn-primary" type="submit">
        {loading ? "Sending..." : "Send Lead"}
      </button>

      {done && <p className="notice success">Lead sent successfully.</p>}
      {error && <p className="notice error">{error}</p>}
    </form>
  );
}
