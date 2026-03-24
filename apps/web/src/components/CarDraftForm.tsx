"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import CityField from "@/components/CityField";
import { useLocale } from "@/components/LocaleProvider";
import { translateStatus, translateValue, type Locale } from "@/lib/locale";

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

type PhotoViewerItem = {
  id: string;
  src: string;
  label: string;
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

function buildPayload(form: FormState, locale: Locale): BuildPayloadResult {
  const city = form.city.trim();
  const make = form.make.trim();
  const model = form.model.trim();
  const title = form.title_ar.trim();
  const description = form.description_ar.trim();
  const isArabic = locale === "ar";

  if (!city || !make || !model || !title || !description) {
    return { ok: false, error: isArabic ? "يرجى تعبئة جميع الحقول المطلوبة." : "Please fill all required fields." };
  }

  const year = Number(form.year);
  const maxYear = new Date().getUTCFullYear() + 1;
  if (!Number.isInteger(year) || year < 1980 || year > maxYear) {
    return { ok: false, error: isArabic ? `يجب أن تكون السنة بين 1980 و ${maxYear}.` : `Year must be between 1980 and ${maxYear}.` };
  }

  const price = Number(form.price_sar);
  if (!Number.isInteger(price) || price <= 0) {
    return { ok: false, error: isArabic ? "يجب أن يكون السعر رقمًا صحيحًا موجبًا." : "Price must be a positive integer." };
  }

  const mileage = parseOptionalNumber(form.mileage_km);
  if (form.mileage_km.trim() && (mileage === undefined || mileage < 0)) {
    return { ok: false, error: isArabic ? "يجب أن يكون الممشى صفرًا أو رقمًا صحيحًا موجبًا." : "Mileage must be zero or a positive integer." };
  }

  const latitude = parseOptionalFloat(form.latitude);
  const longitude = parseOptionalFloat(form.longitude);
  if ((form.latitude.trim() && latitude === undefined) || (form.longitude.trim() && longitude === undefined)) {
    return { ok: false, error: isArabic ? "يجب أن تكون خطوط الطول والعرض أرقامًا صحيحة." : "Latitude/longitude must be valid numbers." };
  }
  if ((latitude !== undefined && longitude === undefined) || (latitude === undefined && longitude !== undefined)) {
    return { ok: false, error: isArabic ? "أدخل خطي العرض والطول معًا أو اتركهما فارغين." : "Provide both latitude and longitude, or leave both empty." };
  }
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    return { ok: false, error: isArabic ? "يجب أن يكون خط العرض بين -90 و 90." : "Latitude must be between -90 and 90." };
  }
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    return { ok: false, error: isArabic ? "يجب أن يكون خط الطول بين -180 و 180." : "Longitude must be between -180 and 180." };
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
  const locale = useLocale();
  const isArabic = locale === "ar";
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
  const [deleting, setDeleting] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const activeCarId = useMemo(
    () => (mode === "edit" ? (carId ?? null) : createdId),
    [mode, carId, createdId],
  );
  const remainingPhotos = Math.max(0, 4 - photos.length);
  const hasEnoughPhotos = photos.length >= 4;
  const isReviewLocked = status === "active" || status === "pending_review";
  const text = isArabic
    ? {
        saveChanges: "حفظ التغييرات",
        saveDraft: "حفظ المسودة",
        photoNumber: (index: number) => `صورة ${index}`,
        invalidCarId: "معرّف السيارة غير صالح.",
        missingApiBase: "متغير NEXT_PUBLIC_API_BASE غير موجود.",
        loadDraftFailed: "تعذر تحميل المسودة.",
        sessionExpired: "انتهت الجلسة. سجل الدخول مرة أخرى.",
        loginRequired: "تسجيل الدخول مطلوب.",
        changesSaved: "تم حفظ التغييرات.",
        draftSaved: "تم حفظ المسودة.",
        saveDraftFailed: "تعذر حفظ المسودة.",
        listingUpdated: "تم تحديث الإعلان بنجاح.",
        listingPendingReview: "تم تحديث الإعلان وهو الآن قيد المراجعة.",
        listingApproved: "تم إرسال الإعلان وتمت الموافقة عليه بنجاح.",
        listingSubmittedPending: "تم إرسال الإعلان وهو الآن قيد المراجعة.",
        listingRejected: "تم رفض الإعلان.",
        listingSubmitted: "تم إرسال الإعلان.",
        submitListingFailed: "تعذر إرسال الإعلان.",
        saveBeforeDelete: "احفظ الإعلان قبل حذفه.",
        deleteConfirm: "هل تريد حذف هذا الإعلان؟ سيتم حذف الإعلان والصور والرسائل المرتبطة به.",
        draftDeleted: "تم حذف المسودة.",
        listingDeleted: "تم حذف الإعلان.",
        deleteFailed: "تعذر حذف الإعلان.",
        selectPhotosFirst: "اختر صورة واحدة أو أكثر أولًا.",
        imagesOnly: "الملفات المسموحة هي الصور فقط.",
        createDraftBeforeUploadFailed: "تعذر إنشاء مسودة قبل رفع الصور.",
        failedUpload: (fileName: string, statusCode: number) => `فشل رفع ${fileName} (${statusCode}).`,
        photosAddedSavedFirst: (count: number) => `تمت إضافة ${count} صورة. تم حفظ الإعلان أولًا.`,
        photosAdded: (count: number) => `تمت إضافة ${count} صورة.`,
        photosAddFailed: (count: number) => `تعذر إضافة ${count} صورة. حاول مرة أخرى.`,
        saveBeforeRemovingPhotos: "احفظ الإعلان قبل حذف الصور.",
        photoRemoved: "تم حذف الصورة.",
        removePhotoFailed: "تعذر حذف الصورة.",
        saveBeforeMainPhoto: "احفظ الإعلان قبل تغيير الصورة الرئيسية.",
        mainPhotoUpdated: "تم تحديث الصورة الرئيسية.",
        updateMainPhotoFailed: "تعذر تحديث الصورة الرئيسية.",
        createDraftTitle: "إنشاء مسودة",
        editListingTitle: (id?: number) => `تعديل الإعلان #${id ?? ""}`,
        formNote: "أدخل تفاصيل الإعلان، واحفظه كمسودة في أي وقت، ثم أرسله عندما تصبح جاهزًا.",
        currentStatus: "الحالة الحالية",
        rejected: "مرفوض",
        loginRequiredForDrafts: "تسجيل الدخول مطلوب لإدارة المسودات.",
        loadingDraft: "جارٍ تحميل المسودة...",
        cityLabel: "المدينة *",
        cityHelp: "اختر مدينة رئيسية أو اختر أخرى لإدخالها يدويًا.",
        otherCity: "اكتب مدينة أخرى",
        district: "الحي",
        make: "الشركة *",
        model: "الموديل *",
        year: "السنة *",
        price: "السعر (ر.س) *",
        mileage: "الممشى (كم)",
        bodyType: "نوع الهيكل",
        selectBodyType: "اختر نوع الهيكل",
        transmission: "ناقل الحركة",
        selectTransmission: "اختر ناقل الحركة",
        fuelType: "نوع الوقود",
        selectFuelType: "اختر نوع الوقود",
        drivetrain: "نظام الدفع",
        selectDrivetrain: "اختر نظام الدفع",
        condition: "الحالة",
        selectCondition: "اختر الحالة",
        color: "اللون",
        selectColor: "اختر اللون",
        titleLabel: "العنوان *",
        descriptionLabel: "الوصف *",
        photos: "الصور",
        photosHelp: "أضف صورًا واضحة تعطي المشتري ثقة. ابدأ بالخارج والداخل والعداد وأي ملاحظات مهمة.",
        autoSaveOnFirstPhotos: "سيتم حفظ الإعلان تلقائيًا عند إضافة أول مجموعة صور.",
        addingPhotos: "جارٍ إضافة الصور...",
        addMorePhotos: "أضف صورًا أخرى",
        addPhotos: "أضف صورًا",
        photosReady: (count: number) => `${count} صور جاهزة`,
        moreNeeded: (count: number) => `${count} أخرى مطلوبة`,
        photosUploadingNow: "يتم الآن إضافة الصور التي اخترتها.",
        choosePhotosAndSave: "اختر صورة أو أكثر ليتم حفظ الإعلان وإضافتها مباشرة.",
        choosePhotos: "اختر صورة أو أكثر. ستتم إضافتها مباشرة.",
        enoughPhotosToPublish: "لديك صور كافية للنشر.",
        morePhotosToPublish: (count: number) => `أضف ${count} صورة إضافية على الأقل للنشر.`,
        adding: "جارٍ الإضافة",
        mainPhoto: "الصورة الرئيسية",
        makeMain: "اجعلها رئيسية",
        removing: "جارٍ الحذف...",
        remove: "حذف",
        noPhotosYet: "لا توجد صور بعد.",
        photoPerformanceNote: "الإعلانات التي تحتوي على صور واضحة ومتعددة تكون أكثر موثوقية.",
        photoViewer: "عارض الصور",
        closePhotoViewer: "إغلاق عارض الصور",
        previousPhoto: "الصورة السابقة",
        nextPhoto: "الصورة التالية",
        saving: "جارٍ الحفظ...",
        submitting: "جارٍ الإرسال...",
        saveAndSubmit: "حفظ وإرسال",
        deleting: "جارٍ الحذف...",
        deleteDraft: "حذف المسودة",
        deleteListing: "حذف الإعلان",
        backToMyCars: "العودة إلى سياراتي",
        editCreatedDraft: "تعديل المسودة التي تم إنشاؤها",
      }
    : {
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
        deleteConfirm: "Delete this listing? This will remove the listing, photos, and related messages.",
        draftDeleted: "Draft deleted.",
        listingDeleted: "Listing deleted.",
        deleteFailed: "Failed to delete listing.",
        selectPhotosFirst: "Select one or more photos first.",
        imagesOnly: "Only image files are allowed.",
        createDraftBeforeUploadFailed: "Failed to create draft before upload.",
        failedUpload: (fileName: string, statusCode: number) => `Failed upload for ${fileName} (${statusCode}).`,
        photosAddedSavedFirst: (count: number) => `${count} photo${count === 1 ? "" : "s"} added. Your listing was saved first.`,
        photosAdded: (count: number) => `${count} photo${count === 1 ? "" : "s"} added.`,
        photosAddFailed: (count: number) => `${count} photo${count === 1 ? "" : "s"} could not be added. Please try again.`,
        saveBeforeRemovingPhotos: "Save the listing before removing photos.",
        photoRemoved: "Photo removed.",
        removePhotoFailed: "Failed to remove photo.",
        saveBeforeMainPhoto: "Save the listing before changing the main photo.",
        mainPhotoUpdated: "Main photo updated.",
        updateMainPhotoFailed: "Failed to update main photo.",
        createDraftTitle: "Create Draft",
        editListingTitle: (id?: number) => `Edit Listing #${id ?? ""}`,
        formNote: "Fill in the listing details, save a draft at any time, and submit when you're ready.",
        currentStatus: "Current status",
        rejected: "Rejected",
        loginRequiredForDrafts: "Login required to manage drafts.",
        loadingDraft: "Loading draft...",
        cityLabel: "City *",
        cityHelp: "Choose a major city or select Other to enter one manually.",
        otherCity: "Enter another city",
        district: "District",
        make: "Make *",
        model: "Model *",
        year: "Year *",
        price: "Price (SAR) *",
        mileage: "Mileage (KM)",
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
        titleLabel: "Title (Arabic) *",
        descriptionLabel: "Description (Arabic) *",
        photos: "Photos",
        photosHelp: "Add clear photos buyers can trust. Start with the outside, inside, dashboard, and anything important to note.",
        autoSaveOnFirstPhotos: "Your listing will be saved automatically when you add the first photos.",
        addingPhotos: "Adding photos...",
        addMorePhotos: "Add More Photos",
        addPhotos: "Add Photos",
        photosReady: (count: number) => `${count} photos ready`,
        moreNeeded: (count: number) => `${count} more needed`,
        photosUploadingNow: "Your selected photos are being added now.",
        choosePhotosAndSave: "Choose one or more photos to save the listing and add them right away.",
        choosePhotos: "Choose one or more photos. They will be added right away.",
        enoughPhotosToPublish: "You have enough photos to publish.",
        morePhotosToPublish: (count: number) => `Add at least ${count} more photo${count === 1 ? "" : "s"} to publish.`,
        adding: "Adding",
        mainPhoto: "Main photo",
        makeMain: "Make Main",
        removing: "Removing...",
        remove: "Remove",
        noPhotosYet: "No photos yet.",
        photoPerformanceNote: "Listings with several clear photos perform better and are easier to trust.",
        photoViewer: "Photo viewer",
        closePhotoViewer: "Close photo viewer",
        previousPhoto: "Previous photo",
        nextPhoto: "Next photo",
        saving: "Saving...",
        submitting: "Submitting...",
        saveAndSubmit: "Save & Submit",
        deleting: "Deleting...",
        deleteDraft: "Delete Draft",
        deleteListing: "Delete Listing",
        backToMyCars: "Back to My Cars",
        editCreatedDraft: "Edit Created Draft",
      };
  const saveButtonLabel = isReviewLocked ? text.saveChanges : text.saveDraft;
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
        setError(err instanceof Error ? err.message : text.loadDraftFailed);
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

  async function persistDraft(token: string): Promise<CarOut> {
    const result = buildPayload(form, locale);
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

      if (saved.status === "active" || saved.status === "pending_review") {
        redirectToMyCars("success", text.changesSaved);
        return;
      }

      redirectToMyCars("success", text.draftSaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.saveDraftFailed);
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

    setSaving(true);
    try {
      const saved = await persistDraft(token);

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
        redirectToMyCars("error", submitted.review_reason || text.listingRejected);
        return;
      }

      redirectToMyCars("success", text.listingSubmitted);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.submitListingFailed);
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

    const confirmed = window.confirm(text.deleteConfirm);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cars/${activeCarId}`, {
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

      redirectToMyCars("success", status === "draft" ? text.draftDeleted : text.listingDeleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  async function uploadSelectedPhotos(filesToUpload?: File[], previewsToClear?: PendingPhotoPreview[]) {
    setUploadError("");
    setUploadSuccess("");

    if (!API_BASE) {
      setUploadError(text.missingApiBase);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNeedsLogin(true);
      setUploadError(text.loginRequired);
      return;
    }

    const files = filesToUpload ?? selectedFiles;
    if (files.length === 0) {
      setUploadError(text.selectPhotosFirst);
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setUploadError(text.imagesOnly);
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
        setUploadError(err instanceof Error ? err.message : text.createDraftBeforeUploadFailed);
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
    setSelectedFiles([]);

    if (uploadedCount > 0) {
      setUploadSuccess(
        createdForUpload
          ? text.photosAddedSavedFirst(uploadedCount)
          : text.photosAdded(uploadedCount),
      );
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
        throw new Error(text.sessionExpired);
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
      setUploadSuccess(text.photoRemoved);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : text.removePhotoFailed);
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
      setUploadError(err instanceof Error ? err.message : text.updateMainPhotoFailed);
    } finally {
      setMainPhotoId(null);
    }
  }

  const title = mode === "create" ? text.createDraftTitle : text.editListingTitle(carId);

  return (
    <main className="page shell auth-wrap">
      <section className="auth-card draft-card">
        <h1>{title}</h1>
        <p className="auth-note">{text.formNote}</p>

        {status && (
          <p className="car-meta">
            {text.currentStatus}: <strong>{translateStatus(locale, status)}</strong>
          </p>
        )}

        {status === "rejected" && reviewReason ? (
          <p className="notice error">
            {text.rejected}: {reviewReason}
          </p>
        ) : null}

        {needsLogin && <p className="notice">{text.loginRequiredForDrafts}</p>}
        {loading && <p className="notice">{text.loadingDraft}</p>}

        {!loading && (
          <form className="filters" onSubmit={onSubmit}>
            <div className="draft-grid">
              <CityField
                id="city"
                label={text.cityLabel}
                value={form.city}
                onChange={(city) => setForm((prev) => ({ ...prev, city }))}
                helperText={text.cityHelp}
                otherPlaceholder={text.otherCity}
              />

              <div>
                <label className="label" htmlFor="district">{text.district}</label>
                <input
                  id="district"
                  className="input"
                  value={form.district}
                  onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="make">{text.make}</label>
                <input
                  id="make"
                  className="input"
                  value={form.make}
                  onChange={(e) => setForm((prev) => ({ ...prev, make: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="model">{text.model}</label>
                <input
                  id="model"
                  className="input"
                  value={form.model}
                  onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                />
              </div>

              <div>
                <label className="label" htmlFor="year">{text.year}</label>
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

              <div>
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

              <div>
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

              <div>
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

              <div>
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

              <div>
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

              <div>
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

              <div>
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

            <div>
              <label className="label" htmlFor="title">{text.titleLabel}</label>
              <input
                id="title"
                className="input"
                value={form.title_ar}
                onChange={(e) => setForm((prev) => ({ ...prev, title_ar: e.target.value }))}
              />
            </div>

            <div>
              <label className="label" htmlFor="description">{text.descriptionLabel}</label>
              <textarea
                id="description"
                className="textarea"
                rows={6}
                value={form.description_ar}
                onChange={(e) => setForm((prev) => ({ ...prev, description_ar: e.target.value }))}
              />
            </div>

            <section className="upload-panel">
              <h2 className="subheading">{text.photos}</h2>
              <p className="car-meta">{text.photosHelp}</p>

              {!activeCarId && mode === "create" ? (
                <p className="helper-text">{text.autoSaveOnFirstPhotos}</p>
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
                  {uploading ? text.addingPhotos : photos.length > 0 ? text.addMorePhotos : text.addPhotos}
                </button>
                <span className={`status-pill ${hasEnoughPhotos ? "status-active" : "status-pending-review"}`}>
                  {hasEnoughPhotos ? text.photosReady(photos.length) : text.moreNeeded(remainingPhotos)}
                </span>
                <span className="helper-text">
                  {uploading
                    ? text.photosUploadingNow
                    : !activeCarId && mode === "create"
                      ? text.choosePhotosAndSave
                      : text.choosePhotos}
                </span>
              </div>

              <p className="helper-text">
                {hasEnoughPhotos
                  ? text.enoughPhotosToPublish
                  : text.morePhotosToPublish(remainingPhotos)}
              </p>

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
                        <span className="status-pill status-draft">{text.adding}</span>
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
                              disabled={mainPhotoId === photo.id || removingPhotoId === photo.id || uploading}
                            >
                              {mainPhotoId === photo.id ? text.saving : text.makeMain}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="upload-photo-button"
                            onClick={() => void removePhoto(photo.id)}
                            disabled={mainPhotoId === photo.id || removingPhotoId === photo.id || uploading}
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
                  <p className="helper-text">{text.photoPerformanceNote}</p>
                </div>
              )}
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
              <button className="btn btn-secondary" type="submit" disabled={saving || loading}>
                {saving ? text.saving : saveButtonLabel}
              </button>
              {!isReviewLocked ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={saving || loading}
                  onClick={() => void handleSubmitForReview()}
                >
                  {saving ? text.submitting : text.saveAndSubmit}
                </button>
              ) : null}
              {activeCarId ? (
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={deleting || saving || loading}
                  onClick={() => void handleDeleteListing()}
                >
                  {deleting ? text.deleting : status === "draft" ? text.deleteDraft : text.deleteListing}
                </button>
              ) : null}
              <Link href="/my-cars" className="btn btn-secondary">{text.backToMyCars}</Link>
              {createdId ? (
                <Link href={`/my-cars/${createdId}/edit`} className="btn btn-secondary">
                  {text.editCreatedDraft}
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
