"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import {
  formatListingPrice,
  formatMileage,
  formatShortDate,
  translateApiMessage,
  translateReviewReason,
  translateStatus,
} from "@/lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "autointel_access_token";
const FLASH_KEY = "autointel_flash";

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
  price_sar?: number | null;
  mileage_km?: number;
  title_ar: string;
  photos: CarPhoto[];
  created_at: string;
};

type MeResponse = {
  id: number;
  name: string | null;
  user_id: string | null;
  phone_e164: string;
  role: string;
  verified_at: string | null;
};

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="car-thumb-nav-icon"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={direction === "left" ? "M12.5 4.5L7.5 10l5 5.5" : "M7.5 4.5l5 5.5-5 5.5"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getOrderedPhotos(photos: CarPhoto[]): CarPhoto[] {
  return [...photos].sort((a, b) => {
    if (a.is_cover !== b.is_cover) {
      return a.is_cover ? -1 : 1;
    }
    return a.sort_order - b.sort_order || a.id - b.id;
  });
}

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return translateApiMessage("en", detail || `Failed with status ${res.status}`);
}

export default function MyCarsPage() {
  const locale = useLocale();
  const [cars, setCars] = useState<MyCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [adminActionId, setAdminActionId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [userId, setUserId] = useState("");
  const [savingUserId, setSavingUserId] = useState(false);
  const [photoIndexes, setPhotoIndexes] = useState<Record<number, number>>({});
  const text = {
    missingApiBase: "NEXT_PUBLIC_API_BASE is missing.",
    sessionExpired: "Your session is missing or expired. Please login again.",
    loadListingsFailed: "Failed to load your listings.",
    loginRequired: "Login required.",
    submitSuccess: (carId: number) => `Car #${carId} submitted for review.`,
    submitFailed: "Failed to submit listing.",
    userIdRequired: "User ID is required.",
    userIdUpdated: (nextUserId: string) => `User ID updated to @${nextUserId}.`,
    userIdUpdateFailed: "Failed to update user ID.",
    approveSuccess: (carId: number) => `Car #${carId} approved.`,
    approveFailed: "Failed to approve listing.",
    rejectionReasonPrompt: "Rejection reason",
    rejectionReasonDefault: "Needs manual fixes",
    rejectSuccess: (carId: number) => `Car #${carId} rejected.`,
    rejectFailed: "Failed to reject listing.",
    title: "Seller Hub",
    subtitle: "",
    profileKicker: "AutoIntel Seller",
    loading: "Loading...",
    refresh: "Refresh",
    account: "Account",
    profileMember: "AutoIntel Member",
    accountSummary: "Seller ID",
    listingsSection: "Your Cars",
    listingsSectionHelp: "Draft, publish, edit, or archive.",
    adminBadge: "Admin",
    phone: "Phone",
    publicUserId: "Public User ID",
    userIdHelp: "Use 3-32 lowercase letters, numbers, dots, underscores, or hyphens.",
    saving: "Saving...",
    saveUserId: "Save User ID",
    loginRequiredForCars: "Login is required to view your profile.",
    noListingsYet: "No cars yet.",
    cityNotSet: "Location not set",
    createdOn: (value: string) => `Created ${value}`,
    review: "Review",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    photoCount: (index: number, total: number) => `${index}/${total}`,
    fixAndResubmit: "Fix",
    editListing: "Edit",
    submitting: "Submitting...",
    submitForReview: "Publish",
    working: "Working...",
    approve: "Approve",
    reject: "Reject",
    openPublicListing: "View",
    publicPageAfterActive: "Visible after publishing.",
    currentStatus: "Current status",
  };

  const canLoad = useMemo(() => Boolean(API_BASE), []);

  const loadCars = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setNeedsLogin(false);

    if (!canLoad || !API_BASE) {
      setError(text.missingApiBase);
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
        setError(text.sessionExpired);
        setLoading(false);
        return;
      }

      if (!meRes.ok) {
        throw new Error(await parseApiError(meRes));
      }

      const me = (await meRes.json()) as MeResponse;
      setMe(me);
      setUserId(me.user_id || "");
      setIsAdmin(me.role === "admin");

      const res = await fetch(`${API_BASE}/v1/seller/cars`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        setError(text.sessionExpired);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const data = (await res.json()) as MyCar[];
      setCars(data);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.loadListingsFailed);
    } finally {
      setLoading(false);
    }
  }, [canLoad, text.loadListingsFailed, text.missingApiBase, text.sessionExpired]);

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
      setError(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError(text.loginRequired);
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
      setSuccess(text.submitSuccess(carId));
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.submitFailed);
    } finally {
      setSubmittingId(null);
    }
  }

  async function saveUserId(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!canLoad || !API_BASE) {
      setError(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError(text.loginRequired);
      return;
    }

    if (!userId.trim()) {
      setError(text.userIdRequired);
      return;
    }

    setSavingUserId(true);
    try {
      const res = await fetch(`${API_BASE}/v1/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId.trim() }),
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        throw new Error("Session expired. Please login again.");
      }

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const updatedMe = (await res.json()) as MeResponse;
      setMe(updatedMe);
      setUserId(updatedMe.user_id || "");
      setSuccess(text.userIdUpdated(updatedMe.user_id || ""));
      window.dispatchEvent(new Event("autointel-auth-changed"));
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.userIdUpdateFailed);
    } finally {
      setSavingUserId(false);
    }
  }

  async function approveCar(carId: number) {
    setError("");
    setSuccess("");

    if (!canLoad || !API_BASE) {
      setError(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError(text.loginRequired);
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
      setSuccess(text.approveSuccess(carId));
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.approveFailed);
    } finally {
      setAdminActionId(null);
    }
  }

  async function rejectCar(carId: number) {
    setError("");
    setSuccess("");

    if (!canLoad || !API_BASE) {
      setError(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError(text.loginRequired);
      return;
    }

    const reason = window.prompt(text.rejectionReasonPrompt, text.rejectionReasonDefault);
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
      setSuccess(text.rejectSuccess(carId));
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.rejectFailed);
    } finally {
      setAdminActionId(null);
    }
  }

  function showListingPhoto(carId: number, photoCount: number, direction: -1 | 1) {
    setPhotoIndexes((prev) => {
      const current = prev[carId] ?? 0;
      return {
        ...prev,
        [carId]: (current + direction + photoCount) % photoCount,
      };
    });
  }

  return (
    <main className="page shell profile-page">
      <section className="profile-hero">
        <div className="profile-hero-copy">
          <p className="hero-kicker">{text.profileKicker}</p>
          <h1>{text.title}</h1>
          {text.subtitle ? <p>{text.subtitle}</p> : null}
        </div>
      </section>

      {!needsLogin && me && (
        <section className="profile-account-layout">
          <div className="panel profile-account-panel profile-account-compact">
            <div className="profile-section-head">
              <div>
                <h2 className="subheading">{text.account}</h2>
              </div>
            </div>
            <form className="profile-user-id-form" onSubmit={saveUserId}>
              <div className="profile-user-id-field">
                <label className="label" htmlFor="user-id">{text.publicUserId}</label>
                <input
                  id="user-id"
                  className="input"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="user-123"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p className="helper-text">{text.userIdHelp}</p>
              </div>
              <div className="profile-user-id-actions">
                <button type="submit" className="btn btn-secondary" disabled={savingUserId}>
                  {savingUserId ? text.saving : text.saveUserId}
                </button>
              </div>
            </form>
          </div>

          <div className="profile-identity-card">
            <p className="profile-identity-label">{text.accountSummary}</p>
            <h2 className="profile-identity-title">
              {me.name || (me.user_id ? `@${me.user_id}` : text.profileMember)}
            </h2>
            {me.name && me.user_id ? <p className="profile-identity-handle">@{me.user_id}</p> : null}
            <div className="profile-identity-meta">
              <span>{text.phone}: {me.phone_e164}</span>
              {isAdmin ? <span>{text.adminBadge}</span> : null}
            </div>
          </div>
        </section>
      )}

      {needsLogin && (
        <div className="notice">
          {text.loginRequiredForCars}
        </div>
      )}

      {error && <div className="notice error">{error}</div>}
      {success && <div className="notice success">{success}</div>}

      {!loading && !needsLogin && !error && cars.length === 0 && (
        <div className="panel profile-empty">
          <h2 className="subheading">{text.listingsSection}</h2>
          <p className="helper-text">{text.noListingsYet}</p>
        </div>
      )}

      {!loading && !needsLogin && cars.length > 0 && (
        <section className="spaced-top">
          <div className="profile-section-head">
            <div>
              <h2 className="subheading">{text.listingsSection}</h2>
              <p className="helper-text">{text.listingsSectionHelp}</p>
            </div>
          </div>
          <div className="profile-listing-grid">
            {cars.map((car) => {
              const photos = getOrderedPhotos(car.photos);
              const photoIndex = Math.min(photoIndexes[car.id] ?? 0, Math.max(photos.length - 1, 0));
              const activePhoto = photos[photoIndex]?.public_url || "";
              const hasMultiplePhotos = photos.length > 1;
              const statusClass = `status-pill status-${car.status.replace(/_/g, "-")}`;

              return (
                <article key={car.id} className="car-card profile-listing-card">
                  <div className="car-media profile-listing-media">
                    {activePhoto ? (
                      <img className="car-thumb profile-listing-thumb" src={activePhoto} alt={car.title_ar || `${car.make} ${car.model}`} />
                    ) : (
                      <div className="car-thumb profile-listing-thumb" aria-hidden="true" />
                    )}
                    {hasMultiplePhotos ? (
                      <>
                        <button
                          type="button"
                          className="car-thumb-nav car-thumb-nav-prev"
                          onClick={() => showListingPhoto(car.id, photos.length, -1)}
                          aria-label={text.previousPhoto}
                          dir="ltr"
                        >
                          <ChevronIcon direction="left" />
                        </button>
                        <button
                          type="button"
                          className="car-thumb-nav car-thumb-nav-next"
                          onClick={() => showListingPhoto(car.id, photos.length, 1)}
                          aria-label={text.nextPhoto}
                          dir="ltr"
                        >
                          <ChevronIcon direction="right" />
                        </button>
                        <p className="car-thumb-count" aria-live="polite">
                          {text.photoCount(photoIndex + 1, photos.length)}
                        </p>
                      </>
                    ) : null}
                  </div>

                  <div className="car-body profile-listing-body">
                    <div className="car-row">
                      <h3 className="car-title">{car.title_ar || `${car.make} ${car.model}`}</h3>
                      <span className={statusClass}>{translateStatus(locale, car.status)}</span>
                    </div>

                    <p className="car-meta">{car.make} {car.model} • {car.year}</p>
                    <div className="profile-listing-facts">
                      <p className="car-meta">{car.city || text.cityNotSet}{car.district ? `, ${car.district}` : ""}</p>
                      <p className="car-meta">{formatMileage(car.mileage_km, locale)}</p>
                      <p className="car-meta">{text.createdOn(formatShortDate(car.created_at, locale))}</p>
                    </div>
                    <p className="car-price">{formatListingPrice(car.price_sar, locale)}</p>

                    {car.review_reason ? (
                      <p className="car-meta card-note">
                        {text.review}: {translateReviewReason(locale, car.review_reason)}
                      </p>
                    ) : null}

                    <div className="profile-card-actions">
                  {(car.status === "draft" || car.status === "pending_review" || car.status === "rejected" || car.status === "active" || car.status === "expired") && (
                    <Link href={`/my-cars/${car.id}/edit`} className="btn btn-secondary">
                      {car.status === "rejected" ? text.fixAndResubmit : text.editListing}
                    </Link>
                  )}

                      {car.status === "draft" && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={submittingId === car.id}
                          onClick={() => void submitForReview(car.id)}
                        >
                          {submittingId === car.id ? text.submitting : text.submitForReview}
                        </button>
                      )}

                      {isAdmin && car.status === "pending_review" ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={adminActionId === car.id}
                            onClick={() => void approveCar(car.id)}
                          >
                            {adminActionId === car.id ? text.working : text.approve}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={adminActionId === car.id}
                            onClick={() => void rejectCar(car.id)}
                          >
                            {text.reject}
                          </button>
                        </>
                      ) : null}

                      {car.status === "active" ? (
                        <Link href={`/cars/${car.id}`} className="btn btn-secondary">
                          {text.openPublicListing}
                        </Link>
                      ) : null}
                    </div>

                    {car.status !== "active" ? (
                      <p className="car-meta card-note">{text.publicPageAfterActive}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
