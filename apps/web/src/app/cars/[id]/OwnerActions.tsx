"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "autointel_access_token";

type OwnerActionsProps = {
  ownerId: number;
  carId: number;
  initialStatus: string;
};

type MeResponse = {
  id: number;
  phone_e164: string;
  role: string;
  verified_at: string | null;
};

type SoldResponse = {
  status: string;
  sold_at?: string | null;
  sold_price?: number | null;
};

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return translateApiMessage("en", detail || `Failed with status ${res.status}`);
}

export default function OwnerActions({ ownerId, carId, initialStatus }: OwnerActionsProps) {
  const [isOwner, setIsOwner] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [soldAt, setSoldAt] = useState<string | null>(null);
  const [markingSold, setMarkingSold] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [showSoldConfirm, setShowSoldConfirm] = useState(false);
  const [soldPrice, setSoldPrice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!API_BASE) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const me = (await res.json()) as MeResponse;
        if (me.id === ownerId) {
          setIsOwner(true);
        }
      } catch {
        // ignore auth errors
      }
    };

    void load();
  }, [ownerId]);

  if (!isOwner) return null;

  async function markSold() {
    setError("");
    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setError("Login required.");
      return;
    }

    const trimmedSoldPrice = soldPrice.trim();
    const parsedSoldPrice = trimmedSoldPrice ? Number(trimmedSoldPrice) : null;
    if (parsedSoldPrice !== null && (!Number.isInteger(parsedSoldPrice) || parsedSoldPrice <= 0)) {
      setError("Enter a valid sold price or leave it blank.");
      return;
    }

    setMarkingSold(true);
    setCelebrating(false);

    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/sold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sold_price: parsedSoldPrice }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const data = (await res.json()) as SoldResponse;
      const nextSoldAt = data.sold_at ?? new Date().toISOString();
      setSoldAt(nextSoldAt);
      setCelebrating(true);
      window.setTimeout(() => {
        setStatus(data.status);
        setShowSoldConfirm(false);
        setCelebrating(false);
        setMarkingSold(false);
      }, 850);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark listing sold.");
      setMarkingSold(false);
    }
  }

  return (
    <div className="owner-actions spaced-top-sm">
      <Link href={`/my-cars/${carId}/edit`} className="btn btn-primary">
        Edit Car
      </Link>
      {status === "active" ? (
        <button
          type="button"
          className={`sold-button${celebrating ? " sold-button-celebrate" : ""}`}
          onClick={() => {
            setError("");
            setShowSoldConfirm(true);
          }}
          disabled={markingSold}
          aria-live="polite"
        >
          <span className="sold-button-copy">Sold</span>
          <span className="sold-button-burst" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </button>
      ) : null}
      {showSoldConfirm ? (
        <div className="sold-modal" role="dialog" aria-modal="true" aria-labelledby="sold-modal-title">
          <button
            type="button"
            className="sold-modal-backdrop"
            aria-label="Cancel marking sold"
            onClick={() => {
              if (!markingSold) {
                setShowSoldConfirm(false);
                setError("");
              }
            }}
          />
          <div className="sold-modal-card">
            <p className="hero-kicker">Close listing</p>
            <h2 id="sold-modal-title" className="subheading">Mark this car as sold?</h2>
            <p className="body-copy">
              This will make the listing inactive and record the sold date. You can add the sold price if you want it saved.
            </p>
            <label className="label" htmlFor="sold-price">Sold price optional</label>
            <input
              id="sold-price"
              className="input"
              inputMode="numeric"
              value={soldPrice}
              onChange={(event) => setSoldPrice(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="27996"
              disabled={markingSold}
            />
            {error ? <p className="notice error owner-actions-error">{error}</p> : null}
            <div className="sold-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowSoldConfirm(false);
                  setError("");
                }}
                disabled={markingSold}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`sold-button sold-confirm-button${celebrating ? " sold-button-celebrate" : ""}`}
                onClick={() => void markSold()}
                disabled={markingSold}
              >
                <span className="sold-button-copy">{markingSold ? "Closing..." : "Confirm sold"}</span>
                <span className="sold-button-burst" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {status === "sold" ? (
        <p className="sold-confirmation">
          Sold{soldAt ? ` on ${new Date(soldAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}.
        </p>
      ) : null}
      {error && !showSoldConfirm ? <p className="notice error owner-actions-error">{error}</p> : null}
    </div>
  );
}
