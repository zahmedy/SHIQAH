"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";

import { formatDateTime, formatPrice } from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "nicherides_access_token";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
type ReportType = "listing" | "false_bid";

type MeResponse = {
  role: string;
};

type AdminReport = {
  id: number;
  report_type: ReportType;
  status: ReportStatus;
  car_id: number;
  offer_id: number | null;
  reporter_user_id: number;
  reported_user_id: number | null;
  reason: string;
  notes: string | null;
  admin_notes: string | null;
  reviewed_by_id: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  listing_title: string | null;
  listing_vehicle: string | null;
  offer_amount: number | null;
  reporter_label: string | null;
  reported_user_label: string | null;
};

const STATUS_OPTIONS: Array<["", string] | [ReportStatus, string]> = [
  ["", "All statuses"],
  ["open", "Open"],
  ["reviewing", "Reviewing"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
];

const TYPE_OPTIONS: Array<["", string] | [ReportType, string]> = [
  ["", "All types"],
  ["listing", "Listing reports"],
  ["false_bid", "False bid reports"],
];

function reportTypeLabel(value: ReportType) {
  return value === "false_bid" ? "False bid" : "Listing";
}

function reasonLabel(value: string) {
  return value.replace(/_/g, " ");
}

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return detail || `Failed with status ${res.status}`;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [status, setStatus] = useState("");
  const [reportType, setReportType] = useState("");
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  async function loadReports(nextStatus = status, nextType = reportType) {
    setError("");
    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      setLoading(false);
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const meRes = await fetch(`${API_BASE}/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!meRes.ok) {
        setAuthorized(false);
        return;
      }
      const me = (await meRes.json()) as MeResponse;
      if (me.role !== "admin") {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);

      const qs = new URLSearchParams();
      if (nextStatus) qs.set("status", nextStatus);
      if (nextType) qs.set("report_type", nextType);
      const res = await fetch(`${API_BASE}/v1/admin/reports${qs.toString() ? `?${qs.toString()}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      const data = (await res.json()) as AdminReport[];
      setReports(data);
      setAdminNotes(Object.fromEntries(data.map((report) => [report.id, report.admin_notes || ""])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  // Run once on mount; filter changes call loadReports directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateReport(report: AdminReport, nextStatus?: ReportStatus) {
    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthorized(false);
      return;
    }

    setSavingId(report.id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/admin/reports/${report.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: nextStatus,
          admin_notes: adminNotes[report.id] || "",
        }),
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      const updated = (await res.json()) as AdminReport;
      setReports((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setAdminNotes((current) => ({ ...current, [updated.id]: updated.admin_notes || "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update report.");
    } finally {
      setSavingId(null);
    }
  }

  function handleStatusFilter(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setStatus(next);
    void loadReports(next, reportType);
  }

  function handleTypeFilter(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setReportType(next);
    void loadReports(status, next);
  }

  if (authorized === false) {
    return (
      <main className="page shell">
        <section className="panel">
          <h1 className="subheading">Admin reports</h1>
          <p className="notice error">Admin access required.</p>
          <Link href="/login" className="btn btn-primary">Login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page shell">
      <section className="panel">
        <div className="results-bar">
          <div>
            <h1 className="subheading">Admin reports</h1>
            <p>Review listing reports and false bid reports.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void loadReports()} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="form-grid form-grid-2 spaced-top-sm">
          <div>
            <label className="label" htmlFor="report-status-filter">Status</label>
            <select id="report-status-filter" className="select" value={status} onChange={handleStatusFilter}>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value || "all"} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="report-type-filter">Type</label>
            <select id="report-type-filter" className="select" value={reportType} onChange={handleTypeFilter}>
              {TYPE_OPTIONS.map(([value, label]) => (
                <option key={value || "all"} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p className="notice error spaced-top-sm">{error}</p> : null}
        {loading ? <p className="helper-text spaced-top-sm">Loading reports...</p> : null}

        {!loading && reports.length === 0 ? (
          <div className="empty-state">
            <h3>No reports found</h3>
            <p>Try another status or report type.</p>
          </div>
        ) : null}

        <div className="listing-grid spaced-top-sm">
          {reports.map((report) => (
            <article key={report.id} className="panel panel-soft">
              <div className="results-bar">
                <div>
                  <p className="hero-kicker">{reportTypeLabel(report.report_type)} · {report.status}</p>
                  <h2 className="subheading">{report.listing_vehicle || `Listing #${report.car_id}`}</h2>
                  <p className="car-meta">{report.listing_title}</p>
                </div>
                <Link href={`/cars/${report.car_id}`} className="btn btn-secondary">Open listing</Link>
              </div>

              <div className="specs spaced-top-sm">
                <article className="spec">
                  <p className="spec-key">Reason</p>
                  <p className="spec-val">{reasonLabel(report.reason)}</p>
                </article>
                <article className="spec">
                  <p className="spec-key">Reporter</p>
                  <p className="spec-val">{report.reporter_label || `#${report.reporter_user_id}`}</p>
                </article>
                <article className="spec">
                  <p className="spec-key">Reported user</p>
                  <p className="spec-val">{report.reported_user_label || (report.reported_user_id ? `#${report.reported_user_id}` : "—")}</p>
                </article>
                <article className="spec">
                  <p className="spec-key">Offer</p>
                  <p className="spec-val">{report.offer_amount ? formatPrice(report.offer_amount, "en") : "—"}</p>
                </article>
                <article className="spec">
                  <p className="spec-key">Created</p>
                  <p className="spec-val">{formatDateTime(report.created_at, "en")}</p>
                </article>
              </div>

              {report.notes ? (
                <div className="spaced-top-sm">
                  <p className="label">Reporter notes</p>
                  <p className="body-copy">{report.notes}</p>
                </div>
              ) : null}

              <div className="spaced-top-sm">
                <label className="label" htmlFor={`admin-notes-${report.id}`}>Admin notes</label>
                <textarea
                  id={`admin-notes-${report.id}`}
                  className="textarea"
                  rows={3}
                  value={adminNotes[report.id] || ""}
                  onChange={(event) => setAdminNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                />
              </div>

              <div className="contact-actions spaced-top-sm">
                <button type="button" className="btn btn-secondary" disabled={savingId === report.id} onClick={() => void updateReport(report)}>
                  {savingId === report.id ? "Saving..." : "Save notes"}
                </button>
                <button type="button" className="btn btn-secondary" disabled={savingId === report.id} onClick={() => void updateReport(report, "reviewing")}>
                  Reviewing
                </button>
                <button type="button" className="btn btn-primary" disabled={savingId === report.id} onClick={() => void updateReport(report, "resolved")}>
                  Resolve
                </button>
                <button type="button" className="btn btn-secondary" disabled={savingId === report.id} onClick={() => void updateReport(report, "dismissed")}>
                  Dismiss
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
