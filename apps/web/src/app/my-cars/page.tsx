"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import {
  formatListingPrice,
  formatMileage,
  formatShortDate,
  translateStatus,
} from "@/lib/locale";

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

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return detail || `Failed with status ${res.status}`;
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
  const text = locale === "ar"
    ? {
        missingApiBase: "متغير NEXT_PUBLIC_API_BASE غير موجود.",
        sessionExpired: "جلسة الدخول مفقودة أو منتهية. سجل الدخول مرة أخرى.",
        loadListingsFailed: "تعذر تحميل إعلاناتك.",
        loginRequired: "تسجيل الدخول مطلوب.",
        submitSuccess: (carId: number) => `تم إرسال السيارة #${carId} للمراجعة.`,
        submitFailed: "تعذر إرسال الإعلان.",
        userIdRequired: "اسم المستخدم العام مطلوب.",
        userIdUpdated: (nextUserId: string) => `تم تحديث اسم المستخدم العام إلى @${nextUserId}.`,
        userIdUpdateFailed: "تعذر تحديث اسم المستخدم العام.",
        approveSuccess: (carId: number) => `تمت الموافقة على السيارة #${carId}.`,
        approveFailed: "تعذر الموافقة على الإعلان.",
        rejectionReasonPrompt: "سبب الرفض",
        rejectionReasonDefault: "يحتاج إلى تعديلات يدوية",
        rejectSuccess: (carId: number) => `تم رفض السيارة #${carId}.`,
        rejectFailed: "تعذر رفض الإعلان.",
        title: "الملف الشخصي",
        subtitle: "إدارة الإعلانات والحساب في مكان واحد.",
        profileKicker: "لوحة الحساب",
        createDraft: "أنشئ إعلان",
        loading: "جارٍ التحميل...",
        refresh: "تحديث",
        account: "الحساب",
        accountHelp: "يظهر اسم المستخدم العام في المحادثات ويمكن تغييره في أي وقت.",
        profileMember: "عضو GARAJ",
        accountSummary: "هوية الحساب",
        listingsSection: "إعلاناتك",
        listingsSectionHelp: "تحكم في النشر والمراجعة والتعديلات من مكان واحد.",
        totalListings: "إجمالي الإعلانات",
        liveListings: "المنشورة",
        pendingListings: "قيد المراجعة",
        attentionListings: "تحتاج متابعة",
        adminBadge: "مشرف",
        publicUserId: "اسم المستخدم العام",
        userIdHelp: "من 3 إلى 32 حرفًا: `a-z` و `0-9` و `.` و `_` و `-`",
        phone: "الهاتف",
        accountId: (currentUserId: string | null) => `معرّف الحساب الحالي: ${currentUserId ? `@${currentUserId}` : "غير مضبوط بعد"}`,
        saving: "جارٍ الحفظ...",
        saveUserId: "حفظ اسم المستخدم",
        loginRequiredForCars: "تسجيل الدخول مطلوب لعرض ملفك الشخصي.",
        noListingsYet: "لا توجد إعلانات في ملفك الشخصي حتى الآن.",
        cityNotSet: "الموقع غير محدد",
        createdOn: (value: string) => `تم الإنشاء ${value}`,
        review: "المراجعة",
        fixAndResubmit: "عدّل وأعد الإرسال",
        editListing: "تعديل الإعلان",
        submitting: "جارٍ الإرسال...",
        submitForReview: "إرسال للمراجعة",
        working: "جارٍ التنفيذ...",
        approve: "موافقة",
        reject: "رفض",
        openPublicListing: "فتح الإعلان العام",
        publicPageAfterActive: "الصفحة العامة تظهر بعد أن تصبح الحالة نشطة.",
        currentStatus: "الحالة الحالية",
      }
    : {
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
        title: "Profile",
        subtitle: "Manage your listings and account in one place.",
        profileKicker: "Account Dashboard",
        createDraft: "Create Post",
        loading: "Loading...",
        refresh: "Refresh",
        account: "Account",
        accountHelp: "Your public user ID appears in chat and can be changed at any time.",
        profileMember: "GARAJ Member",
        accountSummary: "Account Identity",
        listingsSection: "Your Listings",
        listingsSectionHelp: "Manage publishing, review, and edits from one place.",
        totalListings: "Total Listings",
        liveListings: "Published",
        pendingListings: "In Review",
        attentionListings: "Need Attention",
        adminBadge: "Admin",
        publicUserId: "Public User ID",
        userIdHelp: "3-32 chars: `a-z`, `0-9`, `.`, `_`, `-`",
        phone: "Phone",
        accountId: (currentUserId: string | null) => `Current account ID: ${currentUserId ? `@${currentUserId}` : "Not set yet"}`,
        saving: "Saving...",
        saveUserId: "Save User ID",
        loginRequiredForCars: "Login is required to view your profile.",
        noListingsYet: "No listings in your profile yet.",
        cityNotSet: "Location not set",
        createdOn: (value: string) => `Created ${value}`,
        review: "Review",
        fixAndResubmit: "Fix and Resubmit",
        editListing: "Edit Listing",
        submitting: "Submitting...",
        submitForReview: "Submit for Review",
        working: "Working...",
        approve: "Approve",
        reject: "Reject",
        openPublicListing: "Open Public Listing",
        publicPageAfterActive: "Public page is available after status becomes Active.",
        currentStatus: "Current status",
      };

  const canLoad = useMemo(() => Boolean(API_BASE), []);
  const profileStats = useMemo(() => {
    const total = cars.length;
    const active = cars.filter((car) => car.status === "active").length;
    const pending = cars.filter((car) => car.status === "pending_review").length;
    const attention = cars.filter((car) => car.status === "draft" || car.status === "rejected").length;
    return { total, active, pending, attention };
  }, [cars]);

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
      setError(err instanceof Error ? err.message : text.loadListingsFailed);
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
      setError(err instanceof Error ? err.message : text.submitFailed);
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
      window.dispatchEvent(new Event("garaj-auth-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : text.userIdUpdateFailed);
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
      setError(err instanceof Error ? err.message : text.approveFailed);
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
      setError(err instanceof Error ? err.message : text.rejectFailed);
    } finally {
      setAdminActionId(null);
    }
  }

  return (
    <main className="page shell profile-page">
      <section className="profile-hero">
        <div className="profile-hero-copy">
          <p className="hero-kicker">{text.profileKicker}</p>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
          <div className="hero-actions">
            <Link href="/my-cars/new" className="btn btn-primary">
              {text.createDraft}
            </Link>
            <button type="button" className="btn btn-secondary" onClick={() => void loadCars()} disabled={loading}>
              {loading ? text.loading : text.refresh}
            </button>
          </div>
        </div>

        {!needsLogin && me ? (
          <div className="profile-identity-card">
            <p className="profile-identity-label">{text.accountSummary}</p>
            <h2 className="profile-identity-title">
              {me.name || (me.user_id ? `@${me.user_id}` : text.profileMember)}
            </h2>
            <p className="profile-identity-handle">
              {me.user_id ? `@${me.user_id}` : me.phone_e164}
            </p>
            <div className="profile-identity-meta">
              <span>{text.phone}: {me.phone_e164}</span>
              {isAdmin ? <span>{text.adminBadge}</span> : null}
            </div>
          </div>
        ) : null}
      </section>

      {!needsLogin && me && (
        <>
          <section className="stats profile-stats spaced-top-sm">
            <article className="stat-card">
              <p className="stat-label">{text.totalListings}</p>
              <p className="stat-value">{profileStats.total}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{text.liveListings}</p>
              <p className="stat-value">{profileStats.active}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{text.pendingListings}</p>
              <p className="stat-value">{profileStats.pending}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{text.attentionListings}</p>
              <p className="stat-value">{profileStats.attention}</p>
            </article>
          </section>

          <section className="panel profile-account-panel spaced-top-sm">
            <div className="profile-section-head">
              <div>
                <h2 className="subheading">{text.account}</h2>
                <p className="helper-text">{text.accountHelp}</p>
              </div>
            </div>
            <form className="filters spaced-top-sm" onSubmit={saveUserId}>
              <div className="form-grid form-grid-2">
                <div>
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

                <div>
                  <label className="label" htmlFor="account-phone">{text.phone}</label>
                  <input id="account-phone" className="input" value={me.phone_e164} disabled />
                  <p className="helper-text">{text.accountId(me.user_id)}</p>
                </div>
              </div>

              <div className="inline-actions">
                <button type="submit" className="btn btn-primary" disabled={savingUserId}>
                  {savingUserId ? text.saving : text.saveUserId}
                </button>
              </div>
            </form>
          </section>
        </>
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
          <div className="hero-actions">
            <Link href="/my-cars/new" className="btn btn-primary">
              {text.createDraft}
            </Link>
          </div>
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
              const cover = car.photos.find((photo) => photo.is_cover)?.public_url || car.photos[0]?.public_url || "";
              const statusClass = `status-pill status-${car.status.replace(/_/g, "-")}`;

              return (
                <article key={car.id} className="car-card profile-listing-card">
                  {cover ? (
                    <img className="car-thumb profile-listing-thumb" src={cover} alt={car.title_ar || `${car.make} ${car.model}`} />
                  ) : (
                    <div className="car-thumb profile-listing-thumb" aria-hidden="true" />
                  )}

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
                        {text.review}: {car.review_reason}
                      </p>
                    ) : null}

                    <div className="profile-card-actions">
                      {(car.status === "draft" || car.status === "pending_review" || car.status === "rejected" || car.status === "active") && (
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
