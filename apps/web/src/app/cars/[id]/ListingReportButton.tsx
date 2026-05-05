"use client";

import { FormEvent, useEffect, useState } from "react";

import { translateApiMessage } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";

const LISTING_REPORT_REASONS = [
  ["misleading_details", "Misleading details"],
  ["wrong_vehicle", "Wrong vehicle"],
  ["duplicate", "Duplicate listing"],
  ["already_sold", "Already sold"],
  ["scam_or_spam", "Scam or spam"],
  ["prohibited_content", "Prohibited content"],
  ["other", "Other"],
] as const;

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return translateApiMessage("en", detail || `Failed with status ${res.status}`);
}

type MeResponse = {
  id: number;
};

export default function ListingReportButton({ carId, ownerId }: { carId: number; ownerId: number }) {
  const [canReport, setCanReport] = useState(true);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("misleading_details");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadViewer() {
      if (!API_BASE) return;
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const me = (await res.json()) as MeResponse;
        setCanReport(me.id !== ownerId);
      } catch {
        // Keep the report action visible for signed-out or transient auth failures.
      }
    }

    void loadViewer();
  }, [ownerId]);

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setError("Sign in before reporting a listing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      setStatus("Report submitted for admin review.");
      setNotes("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canReport) {
    return null;
  }

  return (
    <div className="spaced-top-sm">
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Report listing
      </button>
      {status ? <p className="helper-text">{status}</p> : null}
      {error && !open ? <p className="notice error">{error}</p> : null}

      {open ? (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Report listing">
          <button
            type="button"
            className="photo-viewer-backdrop"
            aria-label="Cancel report"
            onClick={() => {
              if (!submitting) {
                setOpen(false);
                setError("");
              }
            }}
          />
          <form className="photo-viewer-card offer-confirm-card" onSubmit={submitReport}>
            <h4 className="offer-confirm-title">Report listing</h4>
            <label className="label" htmlFor={`listing-report-reason-${carId}`}>Reason</label>
            <select
              id={`listing-report-reason-${carId}`}
              className="select"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
            >
              {LISTING_REPORT_REASONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <label className="label spaced-top-sm" htmlFor={`listing-report-notes-${carId}`}>Notes optional</label>
            <textarea
              id={`listing-report-notes-${carId}`}
              className="textarea"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={submitting}
              placeholder="Add details for the admin reviewer."
            />
            {error ? <p className="notice error">{error}</p> : null}
            <div className="offer-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
