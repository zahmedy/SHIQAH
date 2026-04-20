"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import CityField from "@/components/CityField";
import MakeModelField from "@/components/MakeModelField";
import { useLocale } from "@/components/LocaleProvider";
import { translateApiMessage, translateReviewReason, translateStatus, translateValue } from "@/lib/locale";
import { findNearestCity } from "@/shared/cities";
import { findMake } from "@/shared/carMakes";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "autointel_access_token";
const FLASH_KEY = "autointel_flash";

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
  price_sar?: number | null;
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
  ml_status?: string | null;
  ml_source?: string | null;
  ml_make?: string | null;
  ml_model?: string | null;
  ml_year_start?: number | null;
  ml_year_end?: number | null;
  ml_confidence?: number | null;
  ml_raw?: string | null;
  ml_updated_at?: string | null;
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

type VinScanResponse = {
  vin: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  body_type?: string | null;
  transmission?: string | null;
  fuel_type?: string | null;
  drivetrain?: string | null;
  message?: string | null;
};

type DescriptionFillResponse = {
  description_ar: string;
};

type PendingPhotoPreview = {
  id: string;
  fileName: string;
  objectUrl: string;
  file: File;
};

type PhotoViewerItem = {
  id: string;
  src: string;
  label: string;
};

function normalizePhotoOrder(nextPhotos: CarPhoto[]) {
  const currentCoverId = nextPhotos.find((photo) => photo.is_cover)?.id ?? null;
  return nextPhotos.map((photo, index) => ({
    ...photo,
    sort_order: index,
    is_cover: currentCoverId ? photo.id === currentCoverId : index === 0,
  }));
}

const initialForm: FormState = {
  city: "Buffalo",
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

const DRAFT_PLACEHOLDER = "__garaj_draft_placeholder__";
const DRAFT_PLACEHOLDER_YEAR = new Date().getUTCFullYear();
const KM_PER_MILE = 1.60934;
const DISALLOWED_REVIEW_TERMS = [
  "wa.me",
  "whatsapp",
  "http://",
  "https://",
  "instagram",
  "snapchat",
  "telegram",
] as const;

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
  return translateApiMessage("en", detail || `Failed with status ${res.status}`);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read image."));
    };
    image.src = objectUrl;
  });
}

type VinPhotoQualityIssue = {
  message: string;
  shouldBlock: boolean;
};

async function getVinPhotoQualityIssue(file: File, text: {
  vinPhotoUnusable: string;
  vinPhotoTooSmall: string;
  vinPhotoTooDark: string;
  vinPhotoLowContrast: string;
  vinPhotoTooBlurry: string;
}): Promise<VinPhotoQualityIssue | null> {
  const image = await loadImageFile(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (Math.min(sourceWidth, sourceHeight) < 90 || sourceWidth * sourceHeight < 15000) {
    return { message: text.vinPhotoUnusable, shouldBlock: true };
  }

  if (Math.min(sourceWidth, sourceHeight) < 300 || sourceWidth * sourceHeight < 150000) {
    return { message: text.vinPhotoTooSmall, shouldBlock: false };
  }

  const scale = Math.min(1, 360 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const grayscale = new Float32Array(width * height);
  let total = 0;

  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const value = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    grayscale[pixel] = value;
    total += value;
  }

  const count = grayscale.length;
  const mean = total / count;
  if (mean < 25 || mean > 245) {
    return { message: text.vinPhotoTooDark, shouldBlock: false };
  }

  let variance = 0;
  for (const value of grayscale) {
    variance += (value - mean) ** 2;
  }
  const contrast = Math.sqrt(variance / count);
  if (contrast < 10) {
    return { message: text.vinPhotoLowContrast, shouldBlock: false };
  }

  let laplacianTotal = 0;
  let laplacianSquareTotal = 0;
  let laplacianCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const centerIndex = y * width + x;
      const laplacian = (
        grayscale[centerIndex - width] +
        grayscale[centerIndex - 1] +
        grayscale[centerIndex + 1] +
        grayscale[centerIndex + width] -
        (4 * grayscale[centerIndex])
      );
      laplacianTotal += laplacian;
      laplacianSquareTotal += laplacian ** 2;
      laplacianCount += 1;
    }
  }

  const laplacianMean = laplacianTotal / laplacianCount;
  const blurScore = (laplacianSquareTotal / laplacianCount) - (laplacianMean ** 2);
  if (blurScore < 10) {
    return { message: text.vinPhotoTooBlurry, shouldBlock: false };
  }

  return null;
}

function normalizeVehicleToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeVinEntry(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
}

function normalizeDecodedVehicleFields(data: VinScanResponse) {
  const makeData = data.make ? findMake(data.make) : undefined;
  const normalizedModel = data.model && makeData
    ? makeData.models.find((model) => normalizeVehicleToken(model) === normalizeVehicleToken(data.model || ""))
    : undefined;

  return {
    make: makeData?.name ?? data.make,
    model: normalizedModel ?? data.model,
  };
}

function milesToKm(value: number): number {
  return Math.round(value * KM_PER_MILE);
}

function kmToMiles(value: number): number {
  return Math.round(value / KM_PER_MILE);
}

function buildPayload(form: FormState): BuildPayloadResult {
  const city = form.city.trim();
  const make = form.make.trim();
  const model = form.model.trim();
  const title = form.title_ar.trim();
  const description = form.description_ar.trim();

  if (!city || !make || !model || !description) {
    return { ok: false, error: "Please fill all required fields." };
  }

  const year = Number(form.year);
  const maxYear = new Date().getUTCFullYear() + 1;
  if (!Number.isInteger(year) || year < 1980 || year > maxYear) {
    return { ok: false, error: `Year must be between 1980 and ${maxYear}.` };
  }

  const price = parseOptionalNumber(form.price_sar);
  if (form.price_sar.trim() && (price === undefined || price <= 0)) {
    return { ok: false, error: "If provided, price must be a positive integer." };
  }

  const mileageMiles = parseOptionalNumber(form.mileage_km);
  if (form.mileage_km.trim() && (mileageMiles === undefined || mileageMiles < 0)) {
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
    price_sar: form.price_sar.trim() ? price : null,
    mileage_km: mileageMiles === undefined ? undefined : milesToKm(mileageMiles),
    body_type: form.body_type.trim() || undefined,
    transmission: form.transmission.trim() || undefined,
    fuel_type: form.fuel_type.trim() || undefined,
    drivetrain: form.drivetrain.trim() || undefined,
    condition: form.condition.trim() || undefined,
    color: form.color.trim() || undefined,
    title_ar: title || `${make} ${model} ${year} for sale`,
    description_ar: description,
  };

  return { ok: true, payload };
}

function fromLoadedField(value?: string | number | null): string {
  const nextValue = field(value);
  return nextValue === DRAFT_PLACEHOLDER ? "" : nextValue;
}

function fromLoadedMileage(value?: number | null): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(kmToMiles(value));
}

export default function CarDraftForm({
  mode,
  carId,
}: {
  mode: DraftFormMode;
  carId?: number;
}) {
  const locale = useLocale();
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
  const [pendingPreviews, setPendingPreviews] = useState<PendingPhotoPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [removingPhotoId, setRemovingPhotoId] = useState<number | null>(null);
  const [mainPhotoId, setMainPhotoId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [vinScanning, setVinScanning] = useState(false);
  const [vinDecoding, setVinDecoding] = useState(false);
  const [manualVin, setManualVin] = useState("");
  const [vinStatus, setVinStatus] = useState("");
  const [vinStatusTone, setVinStatusTone] = useState<"success" | "error" | "">("");
  const [descriptionFilling, setDescriptionFilling] = useState(false);
  const [descriptionFillStatus, setDescriptionFillStatus] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const vinInputRef = useRef<HTMLInputElement | null>(null);

  const activeCarId = useMemo(
    () => (mode === "edit" ? (carId ?? null) : createdId),
    [mode, carId, createdId],
  );
  const isReviewLocked = status === "active" || status === "pending_review";
  const isArchived = status === "expired";
  const text = {
    saveChanges: "Save Changes",
    saveDraft: "Save Draft",
    photoNumber: (index: number) => `Photo ${index}`,
    invalidCarId: "Invalid car id.",
    missingApiBase: "NEXT_PUBLIC_API_BASE is missing.",
    loadDraftFailed: "Failed to load draft.",
    sessionExpired: "Session expired. Please login again.",
    loginRequired: "Login required.",
    changesSaved: "Changes saved.",
    draftSaved: "Draft saved.",
    saveDraftFailed: "Failed to save draft.",
    listingUpdated: "Listing updated successfully.",
    listingPendingReview: "Listing updated and is pending review.",
    listingApproved: "Listing submitted and approved successfully.",
    listingSubmittedPending: "Listing submitted and is pending review.",
    listingRejected: "Listing was rejected.",
    listingSubmitted: "Listing submitted.",
    submitListingFailed: "Failed to submit listing.",
    saveBeforeDelete: "Save the listing before deleting it.",
    archiveConfirm: "Archive this listing? It will be hidden from the public page and search, and you can restore it later.",
    permanentDeleteConfirm: "Delete this listing permanently? This will permanently remove the listing, photos, messages, and offers.",
    draftDeleted: "Draft permanently deleted.",
    listingArchived: "Listing archived.",
    listingDeleted: "Listing permanently deleted.",
    deleteFailed: "Failed to complete the action.",
    selectPhotosFirst: "Select one or more photos first.",
    imagesOnly: "Only image files are allowed.",
    saveBeforeUploadingPhotos: "Click Save Draft before uploading photos.",
    failedUpload: (fileName: string, statusCode: number) => `Failed upload for ${fileName} (${statusCode}).`,
    photosAdded: (count: number) => `${count} photo${count === 1 ? "" : "s"} added.`,
    photosAddFailed: (count: number) => `${count} photo${count === 1 ? "" : "s"} could not be added. Please try again.`,
    saveBeforeRemovingPhotos: "Save the listing before removing photos.",
    photoRemoved: "Photo removed.",
    removePhotoFailed: "Failed to remove photo.",
    saveBeforeMainPhoto: "Save the listing before changing the main photo.",
    mainPhotoUpdated: "Main photo updated.",
    updateMainPhotoFailed: "Failed to update main photo.",
    createDraftTitle: "List a Car",
    editListingTitle: (id?: number) => `Edit Listing #${id ?? ""}`,
    formNote: mode === "create" ? "Choose photos, fill the listing, then Save Draft or Save & Submit." : "Update photos or niche-specific details.",
    sectionBasics: "Basics",
    sectionSpecs: "Niche & Efficiency Specs",
    sectionListing: "Listing Story",
    currentStatus: "Current status",
    vinTitle: "VIN Autofill",
    vinHelp: "Upload a clear VIN photo or type the VIN if the photo is hard to read.",
    vinManualLabel: "VIN",
    vinManualPlaceholder: "17-character VIN",
    vinManualHelp: "Manual VIN decode does not use AI.",
    vinDecode: "Decode VIN",
    vinDecoding: "Decoding...",
    vinUploadPhoto: "Upload VIN Photo",
    vinScanning: "Reading VIN...",
    vinApplied: (vin: string) => `VIN ${vin} detected. Details applied.`,
    vinDetectedOnly: (vin: string) => `VIN ${vin} detected, but details were not decoded.`,
    vinScanFailed: "Failed to read VIN photo.",
    vinManualInvalid: "Enter a valid 17-character VIN.",
    vinPhotoUnusable: "That VIN photo is too small to scan. Try a closer photo or type the VIN.",
    vinPhotoTooSmall: "That VIN photo is small, so it may fail. Trying scan anyway.",
    vinPhotoTooDark: "That VIN photo may be too dark or washed out. Trying scan anyway.",
    vinPhotoLowContrast: "That VIN photo may have low contrast. Trying scan anyway.",
    vinPhotoTooBlurry: "That VIN photo may be blurry. Trying scan anyway.",
    rejected: "Rejected",
    loginRequiredForDrafts: "Login required to manage drafts.",
    loadingDraft: "Loading draft...",
    cityLabel: "City *",
    cityHelp: "Buffalo is the launch market. Change it if the car is in another city.",
    otherCity: "Enter another city",
    useCurrentLocation: "Use my location",
    updateCurrentLocation: "Update location",
    clearCurrentLocation: "Clear precise location",
    locating: "Locating...",
    geolocationUnsupported: "Geolocation not supported in this browser.",
    locationDenied: "Unable to retrieve location.",
    locationSaved: "Precise location saved for this listing.",
    district: "Neighborhood / Suburb",
    make: "Make *",
    model: "Model *",
    year: "Year *",
    price: "Price (USD)",
    mileage: "Mileage (mi)",
    bodyType: "Body Type",
    selectBodyType: "Select body type",
    transmission: "Transmission",
    selectTransmission: "Select transmission",
    fuelType: "Fuel Type",
    selectFuelType: "Select fuel type",
    drivetrain: "Drivetrain",
    selectDrivetrain: "Select drivetrain",
    condition: "Condition",
    selectCondition: "Select condition",
    color: "Color",
    selectColor: "Select color",
    titleLabel: "Title",
    titleHelp: "Example: 2019 RAV4 Hybrid AWD with snow tires.",
    descriptionLabel: "Listing description *",
    descriptionHelp: "Mention the details that matter for this niche: traction, tires, rust condition, warranty, charging setup, maintenance, commute range, or performance/luxury options if relevant.",
    descriptionAiFill: "AI Fill",
    descriptionAiFilling: "Writing...",
    descriptionAiFillNeedsBasics: "Fill make, model, and year first.",
    descriptionAiFillApplied: "Description filled. Review and edit before publishing.",
    descriptionAiFillFailed: "Failed to fill description.",
    photos: "Photos",
    photosHelp: "Add clear exterior, interior, tire, underbody/rust, dashboard, and cargo photos.",
    addingPhotos: "Adding...",
    addMorePhotos: "Add Photos",
    addPhotos: "Add Photos",
    photosReady: (count: number) => `${count} photos ready`,
    moreNeeded: (count: number) => `${count} more needed`,
    photosUploadingNow: "Uploading photos.",
    choosePhotos: "Photos upload when you save.",
    adding: "Adding",
    readyToUpload: "Ready to upload",
    mainPhoto: "Main photo",
    makeMain: "Set Main",
    removing: "Removing...",
    remove: "Remove",
    noPhotosYet: "No photos yet.",
    photoViewer: "Photo viewer",
    closePhotoViewer: "Close photo viewer",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    saving: "Saving...",
    submitting: "Submitting...",
    saveAndSubmit: "Save & Submit",
    deleting: "Deleting...",
    archiving: "Archiving...",
    archiveListing: "Archive Listing",
    deleteDraft: "Delete Permanently",
    deleteListing: "Delete Permanently",
    backToMyCars: "Back to Profile",
    editCreatedDraft: "Edit Created Draft",
    descriptionTooShort: "Description is too short for approval. Add more detail.",
    disallowedContactInfo: "Remove external contact info from the listing text.",
  };
  const saveButtonLabel = isReviewLocked ? text.saveChanges : text.saveDraft;
  const hasPreciseLocation = Boolean(form.latitude.trim() && form.longitude.trim());
  const localizedReviewReason = translateReviewReason(locale, reviewReason);
  const totalPhotoCount = photos.length + pendingPreviews.length;
  const remainingPhotos = Math.max(0, 4 - totalPhotoCount);
  const hasEnoughPhotos = totalPhotoCount >= 4;
  const photoActionInProgress = uploading || removingPhotoId !== null || mainPhotoId !== null;
  const viewerItems = useMemo<PhotoViewerItem[]>(
    () => [
      ...pendingPreviews.map((preview) => ({
        id: preview.id,
        src: preview.objectUrl,
        label: preview.fileName,
      })),
      ...photos.map((photo) => ({
        id: `photo-${photo.id}`,
        src: photo.public_url,
        label: text.photoNumber(photo.sort_order + 1),
      })),
    ],
    [pendingPreviews, photos, text],
  );
  const activeViewerItem =
    viewerIndex !== null && viewerItems[viewerIndex] ? viewerItems[viewerIndex] : null;

  async function fetchCarData(targetCarId: number, token: string): Promise<CarOut> {
    const res = await fetch(`${API_BASE}/v1/cars/${targetCarId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      setNeedsLogin(true);
      throw new Error(text.sessionExpired);
    }
    if (!res.ok) {
      throw new Error(await parseApiError(res));
    }
    return (await res.json()) as CarOut;
  }

  function applyLoadedCar(car: CarOut) {
    setStatus(car.status);
    setReviewReason(car.review_reason || "");
    setPhotos(car.photos || []);
    setForm({
      city: fromLoadedField(car.city),
      district: fromLoadedField(car.district),
      latitude: fromLoadedField(car.latitude),
      longitude: fromLoadedField(car.longitude),
      make: fromLoadedField(car.make),
      model: fromLoadedField(car.model),
      year: car.year === DRAFT_PLACEHOLDER_YEAR && car.make === DRAFT_PLACEHOLDER && car.model === DRAFT_PLACEHOLDER
        ? ""
        : field(car.year),
      price_sar: fromLoadedField(car.price_sar),
      mileage_km: fromLoadedMileage(car.mileage_km),
      body_type: fromLoadedField(car.body_type),
      transmission: fromLoadedField(car.transmission),
      fuel_type: fromLoadedField(car.fuel_type),
      drivetrain: fromLoadedField(car.drivetrain),
      condition: fromLoadedField(car.condition),
      color: fromLoadedField(car.color),
      title_ar: fromLoadedField(car.title_ar),
      description_ar: fromLoadedField(car.description_ar),
    });
  }

  function applyDecodedVinData(data: VinScanResponse) {
    const decodedFields = normalizeDecodedVehicleFields(data);
    const hasDecodedFields = Boolean(
      decodedFields.make ||
      decodedFields.model ||
      data.year ||
      data.body_type ||
      data.transmission ||
      data.fuel_type ||
      data.drivetrain,
    );

    setForm((prev) => ({
      ...prev,
      ...(decodedFields.make ? { make: decodedFields.make } : {}),
      ...(decodedFields.model ? { model: decodedFields.model } : {}),
      ...(data.year ? { year: String(data.year) } : {}),
      ...(data.body_type ? { body_type: data.body_type } : {}),
      ...(data.transmission ? { transmission: data.transmission } : {}),
      ...(data.fuel_type ? { fuel_type: data.fuel_type } : {}),
      ...(data.drivetrain ? { drivetrain: data.drivetrain } : {}),
    }));
    setManualVin(data.vin);
    setVinStatusTone(hasDecodedFields ? "success" : "error");
    setVinStatus(hasDecodedFields ? text.vinApplied(data.vin) : text.vinDetectedOnly(data.vin));
  }

  async function handleManualVinDecode() {
    setError("");
    setSuccess("");
    setVinStatus("");
    setVinStatusTone("");

    const vin = normalizeVinEntry(manualVin);
    setManualVin(vin);

    if (vin.length !== 17) {
      setVinStatusTone("error");
      setVinStatus(text.vinManualInvalid);
      return;
    }
    if (!API_BASE) {
      setVinStatusTone("error");
      setVinStatus(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setVinStatusTone("error");
      setVinStatus(text.loginRequired);
      return;
    }

    setVinDecoding(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/vin/decode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vin }),
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        throw new Error(text.sessionExpired);
      }
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      applyDecodedVinData((await res.json()) as VinScanResponse);
    } catch (err) {
      setVinStatusTone("error");
      setVinStatus(err instanceof Error ? translateApiMessage(locale, err.message) : text.vinScanFailed);
    } finally {
      setVinDecoding(false);
    }
  }

  async function handleVinPhotoSelection(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setSuccess("");
    setVinStatus("");
    setVinStatusTone("");

    if (!file.type.startsWith("image/")) {
      setVinStatusTone("error");
      setVinStatus(text.imagesOnly);
      return;
    }
    if (!API_BASE) {
      setVinStatusTone("error");
      setVinStatus(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setVinStatusTone("error");
      setVinStatus(text.loginRequired);
      return;
    }

    setVinScanning(true);
    try {
      let qualityIssue: VinPhotoQualityIssue | null = null;
      try {
        qualityIssue = await getVinPhotoQualityIssue(file, text);
      } catch {
        qualityIssue = null;
      }
      if (qualityIssue) {
        setVinStatusTone(qualityIssue.shouldBlock ? "error" : "");
        setVinStatus(qualityIssue.message);
        if (qualityIssue.shouldBlock) {
          return;
        }
      }

      const imageBase64 = await readFileAsBase64(file);
      const res = await fetch(`${API_BASE}/v1/cars/vin/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          content_type: file.type || "image/jpeg",
        }),
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        throw new Error(text.sessionExpired);
      }
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      applyDecodedVinData((await res.json()) as VinScanResponse);
    } catch (err) {
      setVinStatusTone("error");
      setVinStatus(err instanceof Error ? translateApiMessage(locale, err.message) : text.vinScanFailed);
    } finally {
      setVinScanning(false);
    }
  }

  async function handleDescriptionAiFill() {
    setError("");
    setSuccess("");
    setDescriptionFillStatus("");

    if (!API_BASE) {
      setDescriptionFillStatus(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setDescriptionFillStatus(text.loginRequired);
      return;
    }

    const make = form.make.trim();
    const model = form.model.trim();
    const year = Number(form.year);
    const maxYear = new Date().getUTCFullYear() + 1;
    if (!make || !model || !Number.isInteger(year) || year < 1980 || year > maxYear) {
      setDescriptionFillStatus(text.descriptionAiFillNeedsBasics);
      return;
    }

    const price = parseOptionalNumber(form.price_sar);
    const mileageMiles = parseOptionalNumber(form.mileage_km);

    setDescriptionFilling(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/description/fill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          city: form.city.trim() || undefined,
          district: form.district.trim() || undefined,
          make,
          model,
          year,
          price_sar: price && price > 0 ? price : undefined,
          mileage_km: mileageMiles !== undefined && mileageMiles >= 0 ? milesToKm(mileageMiles) : undefined,
          body_type: form.body_type.trim() || undefined,
          transmission: form.transmission.trim() || undefined,
          fuel_type: form.fuel_type.trim() || undefined,
          drivetrain: form.drivetrain.trim() || undefined,
          condition: form.condition.trim() || undefined,
          color: form.color.trim() || undefined,
          title_ar: form.title_ar.trim() || undefined,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        throw new Error(text.sessionExpired);
      }
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const data = (await res.json()) as DescriptionFillResponse;
      setForm((prev) => ({ ...prev, description_ar: data.description_ar }));
      setDescriptionFillStatus(text.descriptionAiFillApplied);
    } catch (err) {
      setDescriptionFillStatus(
        err instanceof Error ? translateApiMessage(locale, err.message) : text.descriptionAiFillFailed,
      );
    } finally {
      setDescriptionFilling(false);
    }
  }

  useEffect(() => {
    if (mode !== "edit") return;
    if (!carId) {
      setError(text.invalidCarId);
      setLoading(false);
      return;
    }
    if (!API_BASE) {
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

    const load = async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const car = await fetchCarData(carId, token);
        applyLoadedCar(car);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.loadDraftFailed);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode, carId, text.invalidCarId, text.loadDraftFailed, text.missingApiBase]);

  useEffect(() => {
    return () => {
      for (const preview of pendingPreviews) {
        URL.revokeObjectURL(preview.objectUrl);
      }
    };
  }, [pendingPreviews]);

  useEffect(() => {
    if (viewerIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewerIndex(null);
        return;
      }
      if (event.key === "ArrowRight") {
        setViewerIndex((current) => {
          if (current === null || viewerItems.length === 0) return current;
          return (current + 1) % viewerItems.length;
        });
      }
      if (event.key === "ArrowLeft") {
        setViewerIndex((current) => {
          if (current === null || viewerItems.length === 0) return current;
          return (current - 1 + viewerItems.length) % viewerItems.length;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewerIndex, viewerItems]);

  function redirectToMyCars(type: "success" | "error", message: string) {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message }));
    router.replace("/my-cars");
    router.refresh();
  }

  function validateSubmissionBeforeCreateOrSubmit(): string | null {
    const description = form.description_ar.trim();
    if (description.length < 20) {
      return text.descriptionTooShort;
    }

    if (totalPhotoCount < 4) {
      return translateApiMessage(locale, "At least 4 photos required");
    }

    const content = `${form.title_ar}\n${description}`.toLowerCase();
    if (DISALLOWED_REVIEW_TERMS.some((term) => content.includes(term))) {
      return text.disallowedContactInfo;
    }

    return null;
  }

  async function persistDraft(token: string): Promise<CarOut> {
    const result = buildPayload(form);
    if (result.ok === false) {
      throw new Error(result.error);
    }

    const draftId = mode === "edit" ? carId : createdId;
    const url = draftId ? `${API_BASE}/v1/cars/${draftId}` : `${API_BASE}/v1/cars`;
    const method = draftId ? "PATCH" : "POST";
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
      throw new Error(text.sessionExpired);
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
      throw new Error(text.sessionExpired);
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
      setError(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError(text.loginRequired);
      return;
    }

    setSaving(true);
    try {
      const saved = await persistDraft(token);
      if (pendingPreviews.length > 0) {
        const uploadResult = await uploadSelectedPhotos(saved.id, pendingPreviews.map((preview) => preview.file), pendingPreviews);
        if (uploadResult.failedCount > 0) {
          setError(text.photosAddFailed(uploadResult.failedCount));
          return;
        }
      }

      if (saved.status === "active" || saved.status === "pending_review") {
        redirectToMyCars("success", text.changesSaved);
        return;
      }

      redirectToMyCars("success", text.draftSaved);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.saveDraftFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError(text.loginRequired);
      return;
    }

    const submissionError = validateSubmissionBeforeCreateOrSubmit();
    if (submissionError) {
      setError(submissionError);
      return;
    }

    setSaving(true);
    try {
      const saved = await persistDraft(token);

      if (pendingPreviews.length > 0) {
        const uploadResult = await uploadSelectedPhotos(saved.id, pendingPreviews.map((preview) => preview.file), pendingPreviews);
        if (uploadResult.failedCount > 0) {
          setError(text.photosAddFailed(uploadResult.failedCount));
          return;
        }
        if (uploadResult.totalPhotos < 4) {
          setError(translateApiMessage(locale, "At least 4 photos required"));
          return;
        }
      }

      if (saved.status === "active") {
        redirectToMyCars("success", text.listingUpdated);
        return;
      }

      if (saved.status === "pending_review") {
        redirectToMyCars("success", text.listingPendingReview);
        return;
      }

      const submitted = await submitListingForReview(saved.id, token);

      if (submitted.status === "active") {
        redirectToMyCars("success", text.listingApproved);
        return;
      }

      if (submitted.status === "pending_review") {
        redirectToMyCars("success", text.listingSubmittedPending);
        return;
      }

      if (submitted.status === "rejected") {
        setStatus(submitted.status);
        setReviewReason(submitted.review_reason || "");
        setError(translateReviewReason(locale, submitted.review_reason) || text.listingRejected);
        return;
      }

      redirectToMyCars("success", text.listingSubmitted);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.submitListingFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteListing() {
    setError("");
    setSuccess("");

    if (!API_BASE) {
      setError(text.missingApiBase);
      return;
    }
    if (!activeCarId) {
      setError(text.saveBeforeDelete);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setError(text.loginRequired);
      return;
    }

    const confirmed = window.confirm(isArchived ? text.permanentDeleteConfirm : text.archiveConfirm);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${activeCarId}${isArchived ? "/permanent" : "/archive"}`, {
        method: isArchived ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        throw new Error(text.sessionExpired);
      }

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      redirectToMyCars("success", isArchived ? text.listingDeleted : text.listingArchived);
    } catch (err) {
      setError(err instanceof Error ? translateApiMessage(locale, err.message) : text.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  async function uploadSelectedPhotos(
    targetCarIdOverride?: number,
    filesToUpload?: File[],
    previewsToClear?: PendingPhotoPreview[],
  ): Promise<{ uploadedCount: number; failedCount: number; totalPhotos: number }> {
    setUploadError("");
    setUploadSuccess("");

    if (!API_BASE) {
      setUploadError(text.missingApiBase);
      return { uploadedCount: 0, failedCount: 0, totalPhotos: photos.length };
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setUploadError(text.loginRequired);
      return { uploadedCount: 0, failedCount: 0, totalPhotos: photos.length };
    }

    const files = filesToUpload ?? pendingPreviews.map((preview) => preview.file);
    if (files.length === 0) {
      setUploadError(text.selectPhotosFirst);
      return { uploadedCount: 0, failedCount: 0, totalPhotos: photos.length };
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setUploadError(text.imagesOnly);
      return { uploadedCount: 0, failedCount: 0, totalPhotos: photos.length };
    }

    setUploading(true);

    const targetCarId = targetCarIdOverride ?? activeCarId;

    if (!targetCarId) {
      setUploadError(text.saveBeforeUploadingPhotos);
      setUploading(false);
      return { uploadedCount: 0, failedCount: 0, totalPhotos: photos.length };
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
          throw new Error(text.failedUpload(file.name, uploadRes.status));
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
    if (uploadedCount > 0) {
      setUploadSuccess(text.photosAdded(uploadedCount));
    }
    if (failedCount > 0) {
      setUploadError(text.photosAddFailed(failedCount));
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
    return { uploadedCount, failedCount, totalPhotos: nextPhotos.length };
  }

  function handlePhotoSelection(files: FileList | null) {
    const nextFiles = Array.from(files || []);

    if (nextFiles.length === 0) {
      return;
    }

    const imageFiles = nextFiles.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setUploadError(text.imagesOnly);
      return;
    }

    setUploadError("");
    setUploadSuccess("");

    const previews = imageFiles
      .map((file, index) => ({
        id: `${file.name}-${file.size}-${index}-${Date.now()}`,
        fileName: file.name,
        objectUrl: URL.createObjectURL(file),
        file,
      }));

    if (previews.length > 0) {
      setPendingPreviews((current) => [...current, ...previews]);
    }

  }

  function removePendingPreview(previewId: string) {
    setPendingPreviews((current) => {
      const preview = current.find((item) => item.id === previewId);
      if (preview) {
        URL.revokeObjectURL(preview.objectUrl);
      }
      return current.filter((item) => item.id !== previewId);
    });
    setViewerIndex((current) => {
      if (current === null) return current;

      const removedViewerIndex = viewerItems.findIndex((item) => item.id === previewId);
      if (removedViewerIndex < 0) return current;
      if (viewerItems.length <= 1) return null;
      if (current > removedViewerIndex) return current - 1;
      if (current === removedViewerIndex) return Math.min(current, viewerItems.length - 2);
      return current;
    });
  }

  async function removePhoto(photoId: number) {
    setUploadError("");
    setUploadSuccess("");

    if (!API_BASE) {
      setUploadError(text.missingApiBase);
      return;
    }
    if (!activeCarId) {
      setUploadError(text.saveBeforeRemovingPhotos);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setUploadError(text.loginRequired);
      return;
    }

    const previousPhotos = photos;
    const photoToRemove = previousPhotos.find((photo) => photo.id === photoId);

    if (!photoToRemove) {
      return;
    }

    setRemovingPhotoId(photoId);
    setPhotos(normalizePhotoOrder(previousPhotos.filter((photo) => photo.id !== photoId)));
    setViewerIndex((current) => {
      if (current === null) return current;

      const removedViewerIndex = viewerItems.findIndex((item) => item.id === `photo-${photoId}`);
      if (removedViewerIndex < 0) return current;
      if (viewerItems.length <= 1) return null;
      if (current > removedViewerIndex) return current - 1;
      if (current === removedViewerIndex) return Math.min(current, viewerItems.length - 2);
      return current;
    });

    try {
      const res = await fetch(`${API_BASE}/v1/cars/${activeCarId}/media/${photoId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        setNeedsLogin(true);
        throw new Error(text.sessionExpired);
      }

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setUploadSuccess(text.photoRemoved);
    } catch (err) {
      setPhotos((current) => {
        if (current.some((photo) => photo.id === photoId)) {
          return current;
        }

        const insertAt = Math.min(photoToRemove.sort_order, current.length);
        return normalizePhotoOrder([
          ...current.slice(0, insertAt),
          photoToRemove,
          ...current.slice(insertAt),
        ]);
      });
      setUploadError(err instanceof Error ? translateApiMessage(locale, err.message) : text.removePhotoFailed);
    } finally {
      setRemovingPhotoId(null);
    }
  }

  function openViewer(targetId: string) {
    const index = viewerItems.findIndex((item) => item.id === targetId);
    if (index >= 0) {
      setViewerIndex(index);
    }
  }

  function showNextPhoto() {
    setViewerIndex((current) => {
      if (current === null || viewerItems.length === 0) return current;
      return (current + 1) % viewerItems.length;
    });
  }

  function showPreviousPhoto() {
    setViewerIndex((current) => {
      if (current === null || viewerItems.length === 0) return current;
      return (current - 1 + viewerItems.length) % viewerItems.length;
    });
  }

  function handlePreviewImageClick(event: MouseEvent<HTMLImageElement>) {
    if (viewerItems.length < 2) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const clickOffset = event.clientX - bounds.left;

    if (clickOffset < bounds.width / 2) {
      showPreviousPhoto();
      return;
    }

    showNextPhoto();
  }

  function handleUseCurrentLocation() {
    setLocationStatus("");

    if (!navigator.geolocation) {
      setLocationStatus(text.geolocationUnsupported);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const nearestCity = findNearestCity(latitude, longitude);
        setForm((prev) => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          ...(nearestCity && !prev.city.trim() ? { city: nearestCity } : {}),
        }));
        setLocationStatus(text.locationSaved);
        setLocating(false);
      },
      (error) => {
        setLocationStatus(error.message || text.locationDenied);
        setLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  function handleClearCurrentLocation() {
    setForm((prev) => ({
      ...prev,
      latitude: "",
      longitude: "",
    }));
    setLocationStatus("");
  }

  async function setMainPhoto(photoId: number) {
    setUploadError("");
    setUploadSuccess("");

    if (!API_BASE) {
      setUploadError(text.missingApiBase);
      return;
    }
    if (!activeCarId) {
      setUploadError(text.saveBeforeMainPhoto);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setUploadError(text.loginRequired);
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
        throw new Error(text.sessionExpired);
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
      setUploadSuccess(text.mainPhotoUpdated);
    } catch (err) {
      setUploadError(err instanceof Error ? translateApiMessage(locale, err.message) : text.updateMainPhotoFailed);
    } finally {
      setMainPhotoId(null);
    }
  }

  const title = mode === "create" ? text.createDraftTitle : text.editListingTitle(carId);

  return (
    <main className="page shell auth-wrap">
      <section className="auth-card draft-card">
        <div className="draft-header">
          <div>
            <h1>{title}</h1>
            <p className="auth-note">{text.formNote}</p>
          </div>
          {status ? (
            <div className="draft-status-chip">
              <span className="draft-status-label">{text.currentStatus}</span>
              <strong>{translateStatus(locale, status)}</strong>
            </div>
          ) : null}
        </div>

        {status === "rejected" && reviewReason ? (
          <p className="notice error">
            {text.rejected}: {localizedReviewReason}
          </p>
        ) : null}

        {needsLogin && <p className="notice">{text.loginRequiredForDrafts}</p>}
        {loading && <p className="notice">{text.loadingDraft}</p>}

        {!loading && (
          <form className="filters" onSubmit={onSubmit}>
            <section className="upload-panel upload-panel-hero">
              <div className="draft-section-head">
                <div>
                  <h2 className="subheading">{text.photos}</h2>
                </div>
              </div>

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
                disabled={photoActionInProgress}
              />

              <div className="upload-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoActionInProgress}
                >
                  {uploading ? text.addingPhotos : totalPhotoCount > 0 ? text.addMorePhotos : text.addPhotos}
                </button>
                <span className={`status-pill ${hasEnoughPhotos ? "status-active" : "status-pending-review"}`}>
                  {hasEnoughPhotos ? text.photosReady(totalPhotoCount) : text.moreNeeded(remainingPhotos)}
                </span>
                <span className="helper-text">
                  {uploading ? text.photosUploadingNow : text.choosePhotos}
                </span>
              </div>

              {uploadError && <p className="notice error">{uploadError}</p>}
              {uploadSuccess && <p className="notice success">{uploadSuccess}</p>}

              {photos.length > 0 || pendingPreviews.length > 0 ? (
                <div className="upload-photo-grid">
                  {pendingPreviews.map((preview) => (
                    <article className="upload-photo-item" key={preview.id}>
                      <button
                        type="button"
                        className="upload-photo-preview"
                        onClick={() => openViewer(preview.id)}
                      >
                        <img src={preview.objectUrl} alt={preview.fileName} loading="lazy" />
                      </button>
                      <div className="upload-photo-meta">
                        <span className="upload-photo-order">{preview.fileName}</span>
                        <div className="upload-photo-controls">
                          <span className="status-pill status-draft">{uploading ? text.adding : text.readyToUpload}</span>
                          <button
                            type="button"
                            className="upload-photo-button"
                            onClick={() => removePendingPreview(preview.id)}
                            disabled={uploading}
                          >
                            {text.remove}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {photos.map((photo) => (
                    <article className="upload-photo-item" key={photo.id}>
                      <button
                        type="button"
                        className="upload-photo-preview"
                        onClick={() => openViewer(`photo-${photo.id}`)}
                      >
                        <img src={photo.public_url} alt={`Car photo ${photo.sort_order + 1}`} loading="lazy" />
                      </button>
                      <div className="upload-photo-meta">
                        <span className="upload-photo-order">{text.photoNumber(photo.sort_order + 1)}</span>
                        <div className="upload-photo-controls">
                          {photo.is_cover ? <span className="status-pill status-active">{text.mainPhoto}</span> : null}
                          {!photo.is_cover ? (
                            <button
                              type="button"
                              className="upload-photo-button upload-photo-button-neutral"
                              onClick={() => void setMainPhoto(photo.id)}
                              disabled={photoActionInProgress}
                            >
                              {mainPhotoId === photo.id ? text.saving : text.makeMain}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="upload-photo-button"
                            onClick={() => void removePhoto(photo.id)}
                            disabled={photoActionInProgress}
                          >
                            {removingPhotoId === photo.id ? text.removing : text.remove}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="upload-empty-state">
                  <p className="car-meta">{text.noPhotosYet}</p>
                </div>
              )}
            </section>

            <section className="field-section">
              <div className="draft-section-head">
                <div>
                  <h2 className="subheading">{text.sectionBasics}</h2>
                </div>
              </div>

              <div className="field-card vin-scan-card">
                <div>
                  <p className="location-card-title">{text.vinTitle}</p>
                  <p className="helper-text">{text.vinHelp}</p>
                </div>
                <input
                  ref={vinInputRef}
                  className="upload-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    void handleVinPhotoSelection(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  disabled={vinScanning || vinDecoding}
                />
                <div className="vin-scan-controls">
                  <div className="vin-manual-entry">
                    <label className="label" htmlFor="manual-vin">{text.vinManualLabel}</label>
                    <div className="vin-manual-row">
                      <input
                        id="manual-vin"
                        className="input vin-input"
                        value={manualVin}
                        maxLength={17}
                        placeholder={text.vinManualPlaceholder}
                        onChange={(e) => setManualVin(normalizeVinEntry(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleManualVinDecode();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="field-action-button"
                        onClick={() => void handleManualVinDecode()}
                        disabled={vinDecoding || vinScanning}
                      >
                        {vinDecoding ? text.vinDecoding : text.vinDecode}
                      </button>
                    </div>
                    <p className="helper-text">{text.vinManualHelp}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => vinInputRef.current?.click()}
                    disabled={vinScanning || vinDecoding}
                  >
                    {vinScanning ? text.vinScanning : text.vinUploadPhoto}
                  </button>
                </div>
                {vinStatus ? (
                  <p className={`vin-status${vinStatusTone ? ` vin-status-${vinStatusTone}` : ""}`}>
                    {vinStatus}
                  </p>
                ) : null}
              </div>

              <div className="city-location-grid">
                <div className="field-card field-card-main">
                  <CityField
                    id="city"
                    label={text.cityLabel}
                    value={form.city}
                    onChange={(city) => setForm((prev) => ({ ...prev, city }))}
                    helperText={text.cityHelp || undefined}
                    otherPlaceholder={text.otherCity}
                  />
                </div>
                <div className="field-card location-card">
                  <p className="location-card-title">Location</p>
                  <div className="compact-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleUseCurrentLocation}
                      disabled={locating}
                    >
                      {locating
                        ? text.locating
                        : hasPreciseLocation
                          ? text.updateCurrentLocation
                          : text.useCurrentLocation}
                    </button>
                    {hasPreciseLocation ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={handleClearCurrentLocation}
                        disabled={locating}
                      >
                        {text.clearCurrentLocation}
                      </button>
                    ) : null}
                  </div>
                  {locationStatus || hasPreciseLocation ? (
                    <p className="helper-text">{locationStatus || text.locationSaved}</p>
                  ) : null}
                </div>
              </div>

              <div className="draft-grid draft-grid-top">
                <div className="field-card">
                  <label className="label" htmlFor="district">{text.district}</label>
                  <input
                    id="district"
                    className="input"
                    value={form.district}
                    onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                  />
                </div>

                <div className="field-card">
                  <MakeModelField
                    makeValue={form.make}
                    modelValue={form.model}
                    onMakeChange={(v) => setForm((prev) => ({ ...prev, make: v, model: "" }))}
                    onModelChange={(v) => setForm((prev) => ({ ...prev, model: v }))}
                    makeLabel={text.make}
                    modelLabel={text.model}
                  />
                </div>
              </div>

              <div className="field-grid field-grid-3">
                <div className="field-card">
                  <label className="label" htmlFor="year">{text.year}</label>
                  <input
                    id="year"
                    className="input"
                    list="year-options"
                    inputMode="numeric"
                    placeholder={String(new Date().getUTCFullYear())}
                    value={form.year}
                    onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                    autoComplete="off"
                  />
                  <datalist id="year-options">
                    {Array.from(
                      { length: new Date().getUTCFullYear() + 2 - 1980 },
                      (_, i) => new Date().getUTCFullYear() + 1 - i,
                    ).map((yr) => (
                      <option key={yr} value={yr} />
                    ))}
                  </datalist>
                </div>

                <div className="field-card">
                  <label className="label" htmlFor="price">{text.price}</label>
                  <input
                    id="price"
                    className="input"
                    type="number"
                    min={1}
                    value={form.price_sar}
                    onChange={(e) => setForm((prev) => ({ ...prev, price_sar: e.target.value }))}
                  />
                </div>

                <div className="field-card">
                  <label className="label" htmlFor="mileage">{text.mileage}</label>
                  <input
                    id="mileage"
                    className="input"
                    type="number"
                    min={0}
                    value={form.mileage_km}
                    onChange={(e) => setForm((prev) => ({ ...prev, mileage_km: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="field-section">
              <div className="draft-section-head">
                <div>
                  <h2 className="subheading">{text.sectionSpecs}</h2>
                </div>
              </div>

              <div className="field-grid field-grid-4">
                <div className="field-card">
                  <label className="label" htmlFor="bodyType">{text.bodyType}</label>
                  <select
                    id="bodyType"
                    className="select"
                    value={form.body_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, body_type: e.target.value }))}
                  >
                    <option value="">{text.selectBodyType}</option>
                    {BODY_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {translateValue(locale, option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-card">
                  <label className="label" htmlFor="transmission">{text.transmission}</label>
                  <select
                    id="transmission"
                    className="select"
                    value={form.transmission}
                    onChange={(e) => setForm((prev) => ({ ...prev, transmission: e.target.value }))}
                  >
                    <option value="">{text.selectTransmission}</option>
                    {TRANSMISSION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {translateValue(locale, option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-card">
                  <label className="label" htmlFor="fuelType">{text.fuelType}</label>
                  <select
                    id="fuelType"
                    className="select"
                    value={form.fuel_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, fuel_type: e.target.value }))}
                  >
                    <option value="">{text.selectFuelType}</option>
                    {FUEL_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {translateValue(locale, option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-card">
                  <label className="label" htmlFor="drivetrain">{text.drivetrain}</label>
                  <select
                    id="drivetrain"
                    className="select"
                    value={form.drivetrain}
                    onChange={(e) => setForm((prev) => ({ ...prev, drivetrain: e.target.value }))}
                  >
                    <option value="">{text.selectDrivetrain}</option>
                    {DRIVETRAIN_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {translateValue(locale, option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-card">
                  <label className="label" htmlFor="condition">{text.condition}</label>
                  <select
                    id="condition"
                    className="select"
                    value={form.condition}
                    onChange={(e) => setForm((prev) => ({ ...prev, condition: e.target.value }))}
                  >
                    <option value="">{text.selectCondition}</option>
                    {CONDITION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {translateValue(locale, option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-card">
                  <label className="label" htmlFor="color">{text.color}</label>
                  <select
                    id="color"
                    className="select"
                    value={form.color}
                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                  >
                    <option value="">{text.selectColor}</option>
                    {COLOR_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {translateValue(locale, option)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="field-section">
              <div className="draft-section-head">
                <div>
                  <h2 className="subheading">{text.sectionListing}</h2>
                </div>
              </div>

              <div className="field-card">
                <label className="label" htmlFor="title">{text.titleLabel}</label>
                <input
                  id="title"
                  className="input"
                  placeholder="2019 RAV4 Hybrid AWD with snow tires"
                  value={form.title_ar}
                  onChange={(e) => setForm((prev) => ({ ...prev, title_ar: e.target.value }))}
                />
                {text.titleHelp ? <p className="helper-text">{text.titleHelp}</p> : null}
              </div>

              <div className="field-card">
                <div className="field-label-action">
                  <label className="label" htmlFor="description">{text.descriptionLabel}</label>
                  <button
                    type="button"
                    className="field-action-button"
                    onClick={() => void handleDescriptionAiFill()}
                    disabled={descriptionFilling || saving || loading}
                  >
                    {descriptionFilling ? text.descriptionAiFilling : text.descriptionAiFill}
                  </button>
                </div>
                <textarea
                  id="description"
                  className="textarea"
                  rows={6}
                  placeholder="Include niche-specific details like tires, drivetrain, rust condition, warranty, charging setup, maintenance history, commute range, or performance/luxury options."
                  value={form.description_ar}
                  onChange={(e) => setForm((prev) => ({ ...prev, description_ar: e.target.value }))}
                />
                <p className="helper-text">{text.descriptionHelp}</p>
                {descriptionFillStatus ? <p className="helper-text">{descriptionFillStatus}</p> : null}
              </div>
            </section>

            {activeViewerItem ? (
              <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={text.photoViewer}>
                <button type="button" className="photo-viewer-backdrop" onClick={() => setViewerIndex(null)} aria-label={text.closePhotoViewer} />
                <div className="photo-viewer-card">
                  <button
                    type="button"
                    className="photo-viewer-close"
                    onClick={() => setViewerIndex(null)}
                    aria-label={text.closePhotoViewer}
                  >
                    x
                  </button>
                  {viewerItems.length > 1 ? (
                    <button
                      type="button"
                      className="photo-viewer-nav photo-viewer-prev"
                      onClick={showPreviousPhoto}
                      aria-label={text.previousPhoto}
                      dir="ltr"
                    >
                      ‹
                    </button>
                  ) : null}
                  <img
                    className={`photo-viewer-image${viewerItems.length > 1 ? " photo-viewer-image-interactive" : ""}`}
                    src={activeViewerItem.src}
                    alt={activeViewerItem.label}
                    onClick={handlePreviewImageClick}
                  />
                  {viewerItems.length > 1 ? (
                    <button
                      type="button"
                      className="photo-viewer-nav photo-viewer-next"
                      onClick={showNextPhoto}
                      aria-label={text.nextPhoto}
                      dir="ltr"
                    >
                      ›
                    </button>
                  ) : null}
                  <p className="photo-viewer-caption">
                    {activeViewerItem.label}
                    {viewerItems.length > 1 ? ` (${viewerIndex! + 1}/${viewerItems.length})` : ""}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="auth-actions">
              <button className="btn btn-secondary" type="submit" disabled={saving || loading || uploading}>
                {saving ? text.saving : saveButtonLabel}
              </button>
              {!isReviewLocked ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={saving || loading || uploading}
                  onClick={() => void handleSubmitForReview()}
                >
                  {saving ? text.submitting : text.saveAndSubmit}
                </button>
              ) : null}
              {activeCarId ? (
                <button
                  className={`btn ${isArchived ? "btn-danger" : "btn-secondary"}`}
                  type="button"
                  disabled={deleting || saving || loading || uploading}
                  onClick={() => void handleDeleteListing()}
                >
                  {deleting ? (isArchived ? text.deleting : text.archiving) : (isArchived ? text.deleteListing : text.archiveListing)}
                </button>
              ) : null}
              <Link href="/my-cars" className="btn btn-secondary">{text.backToMyCars}</Link>
            </div>

            {success && <p className="notice success">{success}</p>}
            {error && <p className="notice error">{error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
