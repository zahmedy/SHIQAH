"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "garaj_access_token";

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
  photos?: CarPhoto[];
};

type BuildPayloadResult =
  | { ok: true; payload: CarPayload }
  | { ok: false; error: string };

type FormState = {
  city: string;
  district: string;
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

const initialForm: FormState = {
  city: "",
  district: "",
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

  const payload: CarPayload = {
    city,
    district: form.district.trim() || undefined,
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
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<CarPhoto[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const activeCarId = useMemo(
    () => (mode === "edit" ? (carId ?? null) : createdId),
    [mode, carId, createdId],
  );

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
        setPhotos(car.photos || []);
        setForm({
          city: field(car.city),
          district: field(car.district),
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

    const result = buildPayload(form);
    if (result.ok === false) {
      setError(result.error);
      return;
    }

    setSaving(true);
    try {
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
      setPhotos(data.photos || photos);

      if (mode === "create") {
        setCreatedId(data.id);
        setSuccess(`Draft #${data.id} created.`);
      } else {
        setSuccess(`Draft #${data.id} updated.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadSelectedPhotos() {
    setUploadError("");
    setUploadSuccess("");

    if (!API_BASE) {
      setUploadError("NEXT_PUBLIC_API_BASE is missing.");
      return;
    }

    if (!activeCarId) {
      setUploadError("Create draft first, then upload photos.");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setUploadError("Login required.");
      return;
    }

    if (selectedFiles.length === 0) {
      setUploadError("Select one or more photos first.");
      return;
    }

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setUploadError("Only image files are allowed.");
      return;
    }

    setUploading(true);

    let uploadedCount = 0;
    let failedCount = 0;
    const nextPhotos = [...photos];

    for (const file of imageFiles) {
      try {
        const contentType = file.type || "application/octet-stream";
        const presignRes = await fetch(`${API_BASE}/v1/cars/${activeCarId}/media/presign`, {
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
        const completeRes = await fetch(`${API_BASE}/v1/cars/${activeCarId}/media/complete`, {
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
      setUploadSuccess(`Uploaded ${uploadedCount} photo(s).`);
    }
    if (failedCount > 0) {
      setUploadError(`${failedCount} file(s) failed to upload. Check MinIO CORS and retry.`);
    }

    setUploading(false);
  }

  const title = mode === "create" ? "Create Draft" : `Edit Draft #${carId ?? ""}`;

  return (
    <main className="page shell auth-wrap">
      <section className="auth-card draft-card">
        <h1>{title}</h1>
        <p className="auth-note">
          Fill the required fields now and save as draft. You can update details before submission.
        </p>

        {status && (
          <p className="car-meta">
            Current status: <strong>{status}</strong>
          </p>
        )}

        {needsLogin && <p className="notice">Login required to manage drafts.</p>}
        {loading && <p className="notice">Loading draft...</p>}

        {!loading && (
          <form className="filters" onSubmit={onSubmit}>
            <div className="draft-grid">
              <div>
                <label className="label" htmlFor="city">City *</label>
                <input
                  id="city"
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>

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
                <input
                  id="bodyType"
                  className="input"
                  value={form.body_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, body_type: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="transmission">Transmission</label>
                <input
                  id="transmission"
                  className="input"
                  value={form.transmission}
                  onChange={(e) => setForm((prev) => ({ ...prev, transmission: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="fuelType">Fuel Type</label>
                <input
                  id="fuelType"
                  className="input"
                  value={form.fuel_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, fuel_type: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="drivetrain">Drivetrain</label>
                <input
                  id="drivetrain"
                  className="input"
                  value={form.drivetrain}
                  onChange={(e) => setForm((prev) => ({ ...prev, drivetrain: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="condition">Condition</label>
                <input
                  id="condition"
                  className="input"
                  value={form.condition}
                  onChange={(e) => setForm((prev) => ({ ...prev, condition: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="color">Color</label>
                <input
                  id="color"
                  className="input"
                  value={form.color}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                />
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
              <p className="car-meta">Uploaded photos: {photos.length}. At least 4 are needed before submit for review.</p>

              {activeCarId ? (
                <>
                  <input
                    className="upload-file-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    disabled={uploading}
                  />

                  <div className="upload-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void uploadSelectedPhotos()}
                      disabled={uploading || selectedFiles.length === 0}
                    >
                      {uploading ? "Uploading..." : "Upload Selected"}
                    </button>
                    <span className="car-meta">{selectedFiles.length} file(s) selected</span>
                  </div>
                </>
              ) : (
                <p className="notice">Save draft first to enable photo uploads.</p>
              )}

              {uploadError && <p className="notice error">{uploadError}</p>}
              {uploadSuccess && <p className="notice success">{uploadSuccess}</p>}

              {photos.length > 0 ? (
                <div className="upload-photo-grid">
                  {photos.map((photo) => (
                    <article className="upload-photo-item" key={photo.id}>
                      <img src={photo.public_url} alt={`Car photo ${photo.sort_order + 1}`} loading="lazy" />
                      <div className="upload-photo-meta">
                        <span className="upload-photo-order">#{photo.sort_order + 1}</span>
                        {photo.is_cover ? <span className="status-pill status-active">Cover</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="car-meta">No photos uploaded yet.</p>
              )}
            </section>

            <div className="auth-actions">
              <button className="btn btn-primary" type="submit" disabled={saving || loading}>
                {saving ? "Saving..." : mode === "create" ? "Create Draft" : "Save Changes"}
              </button>
              <Link href="/my-cars" className="btn btn-secondary">Back to My Cars</Link>
              {createdId ? (
                <Link href={`/my-cars/${createdId}/edit`} className="btn btn-secondary">
                  Edit Created Draft
                </Link>
              ) : null}
            </div>

            {error && <p className="notice error">{error}</p>}
            {success && <p className="notice success">{success}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
