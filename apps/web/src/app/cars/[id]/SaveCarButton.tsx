"use client";

import { useEffect, useState } from "react";

import { translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return translateApiMessage("en", detail || `Failed with status ${res.status}`);
}

type SaveStatus = {
  car_id: number;
  saved: boolean;
};

type MeResponse = {
  id: number;
};

export default function SaveCarButton({ carId, ownerId }: { carId: number; ownerId: number }) {
  const [canSave, setCanSave] = useState(true);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSavedStatus() {
      if (!API_BASE) return;
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      try {
        const meRes = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as MeResponse;
          if (me.id === ownerId) {
            setCanSave(false);
            return;
          }
        }
        const res = await fetch(`${API_BASE}/v1/cars/${carId}/save`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const status = (await res.json()) as SaveStatus;
        setSaved(status.saved);
      } catch {
        // A transient auth/network error should not block viewing the listing.
      }
    }

    void loadSavedStatus();
  }, [carId, ownerId]);

  async function toggleSaved() {
    setError("");

    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/save`, {
        method: saved ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      const status = (await res.json()) as SaveStatus;
      setSaved(status.saved);
      window.dispatchEvent(new Event("nicherides-saved-cars-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update saved car.");
    } finally {
      setLoading(false);
    }
  }

  if (!canSave) {
    return null;
  }

  return (
    <div className="listing-save-wrap">
      <button
        type="button"
        className={`btn ${saved ? "btn-primary" : "btn-secondary"} listing-save-button`}
        disabled={loading}
        aria-pressed={saved}
        aria-label={saved ? "Remove saved car" : "Save car"}
        onClick={() => void toggleSaved()}
      >
        {loading ? "..." : saved ? "♥" : "♡"}
      </button>
      {error ? <p className="listing-save-error">{error}</p> : null}
    </div>
  );
}
