"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "garaj_access_token";
const FLASH_KEY = "garaj_flash";

type CarPhoto = {
  id: number;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
};

type MyCar = {
  id: number;
  status: string;
  review_reason?: string;
  review_source?: string;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price_sar: number;
  mileage_km?: number;
  title_ar: string;
  photos: CarPhoto[];
  created_at: string;
};

type MeResponse = {
  id: number;
  name: string | null;
  phone_e164: string;
  role: string;
  verified_at: string | null;
};

const priceFormatter = new Intl.NumberFormat("en-US");

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return detail || `Failed with status ${res.status}`;
}

function prettifyStatus(value: string): string {
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyCarsPage() {
  const [cars, setCars] = useState<MyCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [adminActionId, setAdminActionId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const canLoad = useMemo(() => Boolean(API_BASE), []);

  const loadCars = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setNeedsLogin(false);

    if (!canLoad || !API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setLoading(false);
      return;
    }

    try {
      const meRes = await fetch(`${API_BASE}/v1/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (meRes.status === 401 || meRes.status === 403) {
        setNeedsLogin(true);
        setError("Your session is missing or expired. Please login again.");
        setLoading(false);
        return;
      }

      if (!meRes.ok) {
        throw new Error(await parseApiError(meRes));
      }

      const me = (await meRes.json()) as MeResponse;
      setIsAdmin(me.role === "admin");

      const res = await fetch(`${API_BASE}/v1/seller/cars`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        setError("Your session is missing or expired. Please login again.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const data = (await res.json()) as MyCar[];
      setCars(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your listings.");
    } finally {
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadCars();
  }, [loadCars]);

  useEffect(() => {
    const rawFlash = sessionStorage.getItem(FLASH_KEY);
    if (!rawFlash) {
      return;
    }

    sessionStorage.removeItem(FLASH_KEY);

    try {
      const flash = JSON.parse(rawFlash) as { type?: string; message?: string };
      if (!flash.message) {
        return;
      }

      if (flash.type === "error") {
        setError(flash.message);
        return;
      }

      setSuccess(flash.message);
    } catch {
      // Ignore invalid flash payloads.
    }
  }, []);

  async function submitForReview(carId: number) {
    setError("");
    setSuccess("");

    if (!canLoad || !API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError("Login required.");
      return;
    }

    setSubmittingId(carId);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${carId}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        throw new Error("Session expired. Please login again.");
      }

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setCars((prev) => prev.map((car) => (car.id === carId ? { ...car, status: "pending_review" } : car)));
      setSuccess(`Car #${carId} submitted for review.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit listing.");
    } finally {
      setSubmittingId(null);
    }
  }

  async function approveCar(carId: number) {
    setError("");
    setSuccess("");

    if (!canLoad || !API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError("Login required.");
      return;
    }

    setAdminActionId(carId);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/cars/${carId}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setCars((prev) => prev.map((car) => (car.id === carId ? { ...car, status: "active" } : car)));
      setSuccess(`Car #${carId} approved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve listing.");
    } finally {
      setAdminActionId(null);
    }
  }

  async function rejectCar(carId: number) {
    setError("");
    setSuccess("");

    if (!canLoad || !API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError("Login required.");
      return;
    }

    const reason = window.prompt("Rejection reason", "Needs manual fixes");
    if (!reason) {
      return;
    }

    setAdminActionId(carId);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/cars/${carId}/reject?reason=${encodeURIComponent(reason)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setCars((prev) =>
        prev.map((car) =>
          car.id === carId ? { ...car, status: "rejected", review_reason: reason, review_source: "admin" } : car,
        ),
      );
      setSuccess(`Car #${carId} rejected.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject listing.");
    } finally {
      setAdminActionId(null);
    }
  }

  return (
    <main className="page shell">
      <section className="hero hero-mini">
        <h1>My Cars</h1>
        <p>Track your listings and review status in one place.</p>
      </section>

      <section className="mycars-toolbar">
        <Link href="/my-cars/new" className="btn btn-primary">
          Create Draft
        </Link>
        <button type="button" className="btn btn-secondary" onClick={() => void loadCars()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </section>

      {needsLogin && (
        <div className="notice">
          Login is required to view your cars.
        </div>
      )}

      {error && <div className="notice error">{error}</div>}
      {success && <div className="notice success">{success}</div>}

      {!loading && !needsLogin && !error && cars.length === 0 && (
        <div className="notice">You do not have any listings yet.</div>
      )}

      {!loading && !needsLogin && cars.length > 0 && (
        <section className="listing-grid">
          {cars.map((car) => {
            const cover = car.photos.find((photo) => photo.is_cover)?.public_url || car.photos[0]?.public_url || "";
            const statusClass = `status-pill status-${car.status.replace(/_/g, "-")}`;

            return (
              <article key={car.id} className="car-card">
                {cover ? (
                  <img className="car-thumb" src={cover} alt={car.title_ar || `${car.make} ${car.model}`} />
                ) : (
                  <div className="car-thumb" aria-hidden="true" />
                )}

                <div className="car-body">
                  <div className="car-row">
                    <h3 className="car-title">{car.title_ar || `${car.make} ${car.model}`}</h3>
                    <span className={statusClass}>{prettifyStatus(car.status)}</span>
                  </div>

                  <p className="car-meta">{car.make} {car.model} • {car.year}</p>
                  <p className="car-meta">{car.city}{car.district ? `, ${car.district}` : ""}</p>
                  <p className="car-meta">{car.mileage_km ? `${car.mileage_km.toLocaleString()} km` : "Mileage not set"}</p>
                  <p className="car-meta">Created {formatDate(car.created_at)}</p>
                  <p className="car-price">{priceFormatter.format(car.price_sar)} SAR</p>

                  {car.review_reason ? (
                    <p className="car-meta card-note">
                      Review: {car.review_reason}
                    </p>
                  ) : null}

                  {(car.status === "draft" || car.status === "pending_review" || car.status === "rejected" || car.status === "active") && (
                    <Link href={`/my-cars/${car.id}/edit`} className="btn btn-secondary card-action">
                      {car.status === "rejected" ? "Fix and Resubmit" : "Edit Listing"}
                    </Link>
                  )}

                  {car.status === "draft" && (
                    <button
                      type="button"
                      className="btn btn-primary card-action"
                      disabled={submittingId === car.id}
                      onClick={() => void submitForReview(car.id)}
                    >
                      {submittingId === car.id ? "Submitting..." : "Submit for Review"}
                    </button>
                  )}

                  {isAdmin && car.status === "pending_review" ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary card-action"
                        disabled={adminActionId === car.id}
                        onClick={() => void approveCar(car.id)}
                      >
                        {adminActionId === car.id ? "Working..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary card-action"
                        disabled={adminActionId === car.id}
                        onClick={() => void rejectCar(car.id)}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}

                  {car.status === "active" ? (
                    <Link href={`/cars/${car.id}`} className="btn btn-secondary card-action">
                      Open Public Listing
                    </Link>
                  ) : (
                    <p className="car-meta card-note">Public page is available after status becomes Active.</p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
