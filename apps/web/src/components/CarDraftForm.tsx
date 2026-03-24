"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import CityField from "@/components/CityField";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "garaj_access_token";
const FLASH_KEY = "garaj_flash";

type DraftFormMode = "create" | "edit";

type CarPhoto = {
  id: number;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
};

type CarPayload = {
  city: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  make: string;
  model: string;
  year: number;
  price_sar: number;
  mileage_km?: number;
  body_type?: string;
  transmission?: string;
  fuel_type?: string;
  drivetrain?: string;
  condition?: string;
  color?: string;
  title_ar: string;
  description_ar: string;
};

type CarOut = CarPayload & {
  id: number;
  status: string;
  review_reason?: string | null;
  review_source?: string | null;
  photos?: CarPhoto[];
};

type BuildPayloadResult =
  | { ok: true; payload: CarPayload }
  | { ok: false; error: string };

type FormState = {
  city: string;
  district: string;
  latitude: string;
  longitude: string;
  make: string;
  model: string;
  year: string;
  price_sar: string;
  mileage_km: string;
  body_type: string;
  transmission: string;
  fuel_type: string;
  drivetrain: string;
  condition: string;
  color: string;
  title_ar: string;
  description_ar: string;
};

type PresignResponse = {
  upload_url: string;
  storage_key: string;
  public_url: string;
};

type CompleteResponse = {
  media_id: number;
  public_url: string;
};

type PendingPhotoPreview = {
  id: string;
  fileName: string;
  objectUrl: string;
};

const initialForm: FormState = {
  city: "",
  district: "",
  latitude: "",
  longitude: "",
  make: "",
  model: "",
  year: "",
  price_sar: "",
  mileage_km: "",
  body_type: "",
  transmission: "",
  fuel_type: "",
  drivetrain: "",
  condition: "",
  color: "",
  title_ar: "",
  description_ar: "",
};

const BODY_TYPE_OPTIONS = ["Sedan", "SUV", "Coupe", "Hatchback", "Pickup", "Van"];
const TRANSMISSION_OPTIONS = ["Automatic", "Manual"];
const FUEL_TYPE_OPTIONS = ["Petrol", "Hybrid", "Diesel", "Electric"];
const DRIVETRAIN_OPTIONS = ["FWD", "RWD", "AWD", "4WD"];
const CONDITION_OPTIONS = ["Used", "New"];
const COLOR_OPTIONS = [
  "White",
  "Black",
  "Silver",
  "Gray",
  "Blue",
  "Red",
  "Green",
  "Brown",
  "Beige",
  "Gold",
];

function field(value?: string | number | null): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
}

function parseOptionalFloat(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

async function parseApiError(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  const detail = typeof payload === "string" ? payload : payload?.detail;
  return detail || `Failed with status ${res.status}`;
}

function buildPayload(form: FormState): BuildPayloadResult {
  const city = form.city.trim();
  const make = form.make.trim();
  const model = form.model.trim();
  const title = form.title_ar.trim();
  const description = form.description_ar.trim();

  if (!city || !make || !model || !title || !description) {
    return { ok: false, error: "Please fill all required fields." };
  }

  const year = Number(form.year);
  const maxYear = new Date().getUTCFullYear() + 1;
  if (!Number.isInteger(year) || year < 1980 || year > maxYear) {
    return { ok: false, error: `Year must be between 1980 and ${maxYear}.` };
  }

  const price = Number(form.price_sar);
  if (!Number.isInteger(price) || price <= 0) {
    return { ok: false, error: "Price must be a positive integer." };
  }

  const mileage = parseOptionalNumber(form.mileage_km);
  if (form.mileage_km.trim() && (mileage === undefined || mileage < 0)) {
    return { ok: false, error: "Mileage must be zero or a positive integer." };
  }

  const latitude = parseOptionalFloat(form.latitude);
  const longitude = parseOptionalFloat(form.longitude);
  if ((form.latitude.trim() && latitude === undefined) || (form.longitude.trim() && longitude === undefined)) {
    return { ok: false, error: "Latitude/longitude must be valid numbers." };
  }
  if ((latitude !== undefined && longitude === undefined) || (latitude === undefined && longitude !== undefined)) {
    return { ok: false, error: "Provide both latitude and longitude, or leave both empty." };
  }
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    return { ok: false, error: "Latitude must be between -90 and 90." };
  }
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    return { ok: false, error: "Longitude must be between -180 and 180." };
  }

  const payload: CarPayload = {
    city,
    district: form.district.trim() || undefined,
    latitude,
    longitude,
    make,
    model,
    year,
    price_sar: price,
    mileage_km: mileage,
    body_type: form.body_type.trim() || undefined,
    transmission: form.transmission.trim() || undefined,
    fuel_type: form.fuel_type.trim() || undefined,
    drivetrain: form.drivetrain.trim() || undefined,
    condition: form.condition.trim() || undefined,
    color: form.color.trim() || undefined,
    title_ar: title,
    description_ar: description,
  };

  return { ok: true, payload };
}

export default function CarDraftForm({
  mode,
  carId,
}: {
  mode: DraftFormMode;
  carId?: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<string>("");
  const [reviewReason, setReviewReason] = useState<string>("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<CarPhoto[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<PendingPhotoPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [removingPhotoId, setRemovingPhotoId] = useState<number | null>(null);
  const [mainPhotoId, setMainPhotoId] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const activeCarId = useMemo(
    () => (mode === "edit" ? (carId ?? null) : createdId),
    [mode, carId, createdId],
  );
  const remainingPhotos = Math.max(0, 4 - photos.length);
  const hasEnoughPhotos = photos.length >= 4;
  const isReviewLocked = status === "active" || status === "pending_review";
  const saveButtonLabel = isReviewLocked ? "Save Changes" : "Save Draft";

  useEffect(() => {
    if (mode !== "edit") return;
    if (!carId) {
      setError("Invalid car id.");
      setLoading(false);
      return;
    }
    if (!API_BASE) {
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

    const load = async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`${API_BASE}/v1/cars/${carId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403) {
          setNeedsLogin(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          throw new Error(await parseApiError(res));
        }
        const car = (await res.json()) as CarOut;
        setStatus(car.status);
        setReviewReason(car.review_reason || "");
        setPhotos(car.photos || []);
        setForm({
          city: field(car.city),
          district: field(car.district),
          latitude: field(car.latitude),
          longitude: field(car.longitude),
          make: field(car.make),
          model: field(car.model),
          year: field(car.year),
          price_sar: field(car.price_sar),
          mileage_km: field(car.mileage_km),
          body_type: field(car.body_type),
          transmission: field(car.transmission),
          fuel_type: field(car.fuel_type),
          drivetrain: field(car.drivetrain),
          condition: field(car.condition),
          color: field(car.color),
          title_ar: field(car.title_ar),
          description_ar: field(car.description_ar),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load draft.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode, carId]);

  useEffect(() => {
    return () => {
      for (const preview of pendingPreviews) {
        URL.revokeObjectURL(preview.objectUrl);
      }
    };
  }, [pendingPreviews]);

  function redirectToMyCars(type: "success" | "error", message: string) {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message }));
    router.replace("/my-cars");
    router.refresh();
  }

  async function persistDraft(token: string): Promise<CarOut> {
    const result = buildPayload(form);
    if (result.ok === false) {
      throw new Error(result.error);
    }

    const url = mode === "create" ? `${API_BASE}/v1/cars` : `${API_BASE}/v1/cars/${carId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(result.payload),
    });

    if (res.status === 401 || res.status === 403) {
      setNeedsLogin(true);
      throw new Error("Session expired. Please login again.");
    }

    if (!res.ok) {
      throw new Error(await parseApiError(res));
    }

    const data = (await res.json()) as CarOut;
    setStatus(data.status);
    setReviewReason(data.review_reason || "");
    setPhotos(data.photos || []);

    if (mode === "create") {
      setCreatedId(data.id);
    }

    return data;
  }

  async function submitListingForReview(carIdToSubmit: number, token: string): Promise<CarOut> {
    const res = await fetch(`${API_BASE}/v1/cars/${carIdToSubmit}/submit`, {
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

    const data = (await res.json()) as CarOut;
    setStatus(data.status);
    setReviewReason(data.review_reason || "");
    return data;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError("Login required.");
      return;
    }

    setSaving(true);
    try {
      const saved = await persistDraft(token);

      if (saved.status === "active" || saved.status === "pending_review") {
        redirectToMyCars("success", "Changes saved.");
        return;
      }

      redirectToMyCars("success", "Draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError("Login required.");
      return;
    }

    setSaving(true);
    try {
      const saved = await persistDraft(token);

      if (saved.status === "active") {
        redirectToMyCars("success", "Listing updated successfully.");
        return;
      }

      if (saved.status === "pending_review") {
        redirectToMyCars("success", "Listing updated and is pending review.");
        return;
      }

      const submitted = await submitListingForReview(saved.id, token);

      if (submitted.status === "active") {
        redirectToMyCars("success", "Listing submitted and approved successfully.");
        return;
      }

      if (submitted.status === "pending_review") {
        redirectToMyCars("success", "Listing submitted and is pending review.");
        return;
      }

      if (submitted.status === "rejected") {
        redirectToMyCars("error", submitted.review_reason || "Listing was rejected.");
        return;
      }

      redirectToMyCars("success", "Listing submitted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit listing.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadSelectedPhotos(filesToUpload?: File[], previewsToClear?: PendingPhotoPreview[]) {
    setUploadError("");
    setUploadSuccess("");

    if (!API_BASE) {
      setUploadError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setUploadError("Login required.");
      return;
    }

    const files = filesToUpload ?? selectedFiles;
    if (files.length === 0) {
      setUploadError("Select one or more photos first.");
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setUploadError("Only image files are allowed.");
      return;
    }

    setUploading(true);

    let targetCarId = activeCarId;
    let createdForUpload = false;

    if (!targetCarId) {
      try {
        const draft = await persistDraft(token);
        targetCarId = draft.id;
        createdForUpload = true;
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to create draft before upload.");
        setUploading(false);
        return;
      }
    }

    let uploadedCount = 0;
    let failedCount = 0;
    const nextPhotos = [...photos];

    for (const file of imageFiles) {
      try {
        const contentType = file.type || "application/octet-stream";
        const presignRes = await fetch(`${API_BASE}/v1/cars/${targetCarId}/media/presign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ filename: file.name, content_type: contentType }),
        });

        if (!presignRes.ok) {
          throw new Error(await parseApiError(presignRes));
        }

        const presign = (await presignRes.json()) as PresignResponse;

        const uploadRes = await fetch(presign.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
          },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed upload for ${file.name} (${uploadRes.status}).`);
        }

        const isCover = nextPhotos.length === 0;
        const completeRes = await fetch(`${API_BASE}/v1/cars/${targetCarId}/media/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            storage_key: presign.storage_key,
            public_url: presign.public_url,
            is_cover: isCover,
          }),
        });

        if (!completeRes.ok) {
          throw new Error(await parseApiError(completeRes));
        }

        const completeData = (await completeRes.json()) as CompleteResponse;

        if (isCover) {
          for (let i = 0; i < nextPhotos.length; i += 1) {
            nextPhotos[i] = { ...nextPhotos[i], is_cover: false };
          }
        }

        nextPhotos.push({
          id: completeData.media_id,
          public_url: completeData.public_url || presign.public_url,
          sort_order: nextPhotos.length,
          is_cover: isCover,
        });
        uploadedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    setPhotos(nextPhotos);
    setSelectedFiles([]);

    if (uploadedCount > 0) {
      setUploadSuccess(
        createdForUpload
          ? `${uploadedCount} photo${uploadedCount === 1 ? "" : "s"} added. Your listing was saved first.`
          : `${uploadedCount} photo${uploadedCount === 1 ? "" : "s"} added.`,
      );
    }
    if (failedCount > 0) {
      setUploadError(`${failedCount} photo${failedCount === 1 ? "" : "s"} could not be added. Please try again.`);
    }

    for (const preview of previewsToClear ?? []) {
      URL.revokeObjectURL(preview.objectUrl);
    }
    if (previewsToClear) {
      setPendingPreviews((current) =>
        current.filter((preview) => !previewsToClear.some((item) => item.id === preview.id)),
      );
    }

    setUploading(false);
  }

  function handlePhotoSelection(files: FileList | null) {
    const nextFiles = Array.from(files || []);
    setSelectedFiles(nextFiles);

    if (nextFiles.length === 0) {
      return;
    }

    const previews = nextFiles
      .filter((file) => file.type.startsWith("image/"))
      .map((file, index) => ({
        id: `${file.name}-${file.size}-${index}-${Date.now()}`,
        fileName: file.name,
        objectUrl: URL.createObjectURL(file),
      }));

    if (previews.length > 0) {
      setPendingPreviews((current) => [...current, ...previews]);
    }

    void uploadSelectedPhotos(nextFiles, previews);
  }

  async function removePhoto(photoId: number) {
    setUploadError("");
    setUploadSuccess("");

    if (!API_BASE) {
      setUploadError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }
    if (!activeCarId) {
      setUploadError("Save the listing before removing photos.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setUploadError("Login required.");
      return;
    }

    setRemovingPhotoId(photoId);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${activeCarId}/media/${photoId}`, {
        method: "DELETE",
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

      setPhotos((prev) => {
        const remaining = prev.filter((photo) => photo.id !== photoId);
        const currentCoverId = remaining.find((photo) => photo.is_cover)?.id ?? null;
        return remaining.map((photo, index) => ({
          ...photo,
          sort_order: index,
          is_cover: currentCoverId ? photo.id === currentCoverId : index === 0,
        }));
      });
      setUploadSuccess("Photo removed.");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to remove photo.");
    } finally {
      setRemovingPhotoId(null);
    }
  }

  async function setMainPhoto(photoId: number) {
    setUploadError("");
    setUploadSuccess("");

    if (!API_BASE) {
      setUploadError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }
    if (!activeCarId) {
      setUploadError("Save the listing before changing the main photo.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setUploadError("Login required.");
      return;
    }

    setMainPhotoId(photoId);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${activeCarId}/media/${photoId}/main`, {
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

      setPhotos((prev) => {
        const chosen = prev.find((photo) => photo.id === photoId);
        if (!chosen) {
          return prev;
        }
        const reordered = [chosen, ...prev.filter((photo) => photo.id !== photoId)];
        return reordered.map((photo, index) => ({
          ...photo,
          sort_order: index,
          is_cover: photo.id === photoId,
        }));
      });
      setUploadSuccess("Main photo updated.");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to update main photo.");
    } finally {
      setMainPhotoId(null);
    }
  }

  const title = mode === "create" ? "Create Draft" : `Edit Listing #${carId ?? ""}`;

  return (
    <main className="page shell auth-wrap">
      <section className="auth-card draft-card">
        <h1>{title}</h1>
        <p className="auth-note">
          Fill in the listing details, save a draft at any time, and submit when you're ready.
        </p>

        {status && (
          <p className="car-meta">
            Current status: <strong>{status}</strong>
          </p>
        )}

        {status === "rejected" && reviewReason ? (
          <p className="notice error">
            Rejected: {reviewReason}
          </p>
        ) : null}

        {needsLogin && <p className="notice">Login required to manage drafts.</p>}
        {loading && <p className="notice">Loading draft...</p>}

        {!loading && (
          <form className="filters" onSubmit={onSubmit}>
            <div className="draft-grid">
              <CityField
                id="city"
                label="City *"
                value={form.city}
                onChange={(city) => setForm((prev) => ({ ...prev, city }))}
                helperText="Choose a major city or select Other to enter one manually."
                otherPlaceholder="Enter another city"
              />

              <div>
                <label className="label" htmlFor="district">District</label>
                <input
                  id="district"
                  className="input"
                  value={form.district}
                  onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="make">Make *</label>
                <input
                  id="make"
                  className="input"
                  value={form.make}
                  onChange={(e) => setForm((prev) => ({ ...prev, make: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="model">Model *</label>
                <input
                  id="model"
                  className="input"
                  value={form.model}
                  onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="year">Year *</label>
                <input
                  id="year"
                  className="input"
                  type="number"
                  min={1980}
                  max={new Date().getUTCFullYear() + 1}
                  value={form.year}
                  onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="price">Price (SAR) *</label>
                <input
                  id="price"
                  className="input"
                  type="number"
                  min={1}
                  value={form.price_sar}
                  onChange={(e) => setForm((prev) => ({ ...prev, price_sar: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="mileage">Mileage (KM)</label>
                <input
                  id="mileage"
                  className="input"
                  type="number"
                  min={0}
                  value={form.mileage_km}
                  onChange={(e) => setForm((prev) => ({ ...prev, mileage_km: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="bodyType">Body Type</label>
                <select
                  id="bodyType"
                  className="select"
                  value={form.body_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, body_type: e.target.value }))}
                >
                  <option value="">Select body type</option>
                  {BODY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="transmission">Transmission</label>
                <select
                  id="transmission"
                  className="select"
                  value={form.transmission}
                  onChange={(e) => setForm((prev) => ({ ...prev, transmission: e.target.value }))}
                >
                  <option value="">Select transmission</option>
                  {TRANSMISSION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="fuelType">Fuel Type</label>
                <select
                  id="fuelType"
                  className="select"
                  value={form.fuel_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, fuel_type: e.target.value }))}
                >
                  <option value="">Select fuel type</option>
                  {FUEL_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="drivetrain">Drivetrain</label>
                <select
                  id="drivetrain"
                  className="select"
                  value={form.drivetrain}
                  onChange={(e) => setForm((prev) => ({ ...prev, drivetrain: e.target.value }))}
                >
                  <option value="">Select drivetrain</option>
                  {DRIVETRAIN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="condition">Condition</label>
                <select
                  id="condition"
                  className="select"
                  value={form.condition}
                  onChange={(e) => setForm((prev) => ({ ...prev, condition: e.target.value }))}
                >
                  <option value="">Select condition</option>
                  {CONDITION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="color">Color</label>
                <select
                  id="color"
                  className="select"
                  value={form.color}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                >
                  <option value="">Select color</option>
                  {COLOR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="title">Title (Arabic) *</label>
              <input
                id="title"
                className="input"
                value={form.title_ar}
                onChange={(e) => setForm((prev) => ({ ...prev, title_ar: e.target.value }))}
              />
            </div>

            <div>
              <label className="label" htmlFor="description">Description (Arabic) *</label>
              <textarea
                id="description"
                className="textarea"
                rows={6}
                value={form.description_ar}
                onChange={(e) => setForm((prev) => ({ ...prev, description_ar: e.target.value }))}
              />
            </div>

            <section className="upload-panel">
              <h2 className="subheading">Photos</h2>
              <p className="car-meta">
                Add clear photos buyers can trust. Start with the outside, inside, dashboard, and anything important to note.
              </p>

              {!activeCarId && mode === "create" ? (
                <p className="helper-text">Your listing will be saved automatically when you add the first photos.</p>
              ) : null}

              <input
                ref={photoInputRef}
                className="upload-file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  handlePhotoSelection(e.target.files);
                  e.currentTarget.value = "";
                }}
                disabled={uploading}
              />

              <div className="upload-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Adding photos..." : photos.length > 0 ? "Add More Photos" : "Add Photos"}
                </button>
                <span className={`status-pill ${hasEnoughPhotos ? "status-active" : "status-pending-review"}`}>
                  {hasEnoughPhotos ? `${photos.length} photos ready` : `${remainingPhotos} more needed`}
                </span>
                <span className="helper-text">
                  {uploading
                    ? "Your selected photos are being added now."
                    : !activeCarId && mode === "create"
                      ? "Choose one or more photos to save the listing and add them right away."
                      : "Choose one or more photos. They will be added right away."}
                </span>
              </div>

              <p className="helper-text">
                {hasEnoughPhotos
                  ? "You have enough photos to publish."
                  : `Add at least ${remainingPhotos} more photo${remainingPhotos === 1 ? "" : "s"} to publish.`}
              </p>

              {uploadError && <p className="notice error">{uploadError}</p>}
              {uploadSuccess && <p className="notice success">{uploadSuccess}</p>}

              {photos.length > 0 || pendingPreviews.length > 0 ? (
                <div className="upload-photo-grid">
                  {pendingPreviews.map((preview) => (
                    <article className="upload-photo-item" key={preview.id}>
                      <img src={preview.objectUrl} alt={preview.fileName} loading="lazy" />
                      <div className="upload-photo-meta">
                        <span className="upload-photo-order">{preview.fileName}</span>
                        <span className="status-pill status-draft">Adding</span>
                      </div>
                    </article>
                  ))}
                  {photos.map((photo) => (
                    <article className="upload-photo-item" key={photo.id}>
                      <img src={photo.public_url} alt={`Car photo ${photo.sort_order + 1}`} loading="lazy" />
                      <div className="upload-photo-meta">
                        <span className="upload-photo-order">Photo {photo.sort_order + 1}</span>
                        <div className="upload-photo-controls">
                          {photo.is_cover ? <span className="status-pill status-active">Main photo</span> : null}
                          {!photo.is_cover ? (
                            <button
                              type="button"
                              className="upload-photo-button upload-photo-button-neutral"
                              onClick={() => void setMainPhoto(photo.id)}
                              disabled={mainPhotoId === photo.id || removingPhotoId === photo.id || uploading}
                            >
                              {mainPhotoId === photo.id ? "Saving..." : "Make Main"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="upload-photo-button"
                            onClick={() => void removePhoto(photo.id)}
                            disabled={mainPhotoId === photo.id || removingPhotoId === photo.id || uploading}
                          >
                            {removingPhotoId === photo.id ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="upload-empty-state">
                  <p className="car-meta">No photos yet.</p>
                  <p className="helper-text">Listings with several clear photos perform better and are easier to trust.</p>
                </div>
              )}
            </section>

            <div className="auth-actions">
              <button className="btn btn-secondary" type="submit" disabled={saving || loading}>
                {saving ? "Saving..." : saveButtonLabel}
              </button>
              {!isReviewLocked ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={saving || loading}
                  onClick={() => void handleSubmitForReview()}
                >
                  {saving ? "Submitting..." : "Save & Submit"}
                </button>
              ) : null}
              <Link href="/my-cars" className="btn btn-secondary">Back to My Cars</Link>
              {createdId ? (
                <Link href={`/my-cars/${createdId}/edit`} className="btn btn-secondary">
                  Edit Created Draft
                </Link>
              ) : null}
            </div>

            {success && <p className="notice success">{success}</p>}
            {error && <p className="notice error">{error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
