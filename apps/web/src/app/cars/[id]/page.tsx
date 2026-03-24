import Link from "next/link";

import { apiGet } from "@/lib/api";
import ListingPhotoGallery from "@/components/ListingPhotoGallery";
import { formatDateTime, formatDistance, formatPrice, translateValue, type Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import ChatPanel from "./ChatPanel";
import OwnerActions from "./OwnerActions";

type Photo = {
  id: number;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
};

type Listing = {
  id: number;
  owner_id: number;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price_sar: number;
  mileage_km?: number;
  title_ar: string;
  description_ar: string;
  transmission?: string;
  fuel_type?: string;
  body_type?: string;
  condition?: string;
  color?: string;
  published_at?: string;
  photos: Photo[];
};

type PublicCarResponse = {
  listing: Listing;
  seller: {
    id: number | null;
    name: string | null;
    user_id: string | null;
    phone_e164: string | null;
  };
  contact: {
    whatsapp_url: string | null;
    call_phone_e164: string | null;
  };
};

function specValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function sellerLabel(sellerUserId?: string | null, sellerName?: string | null) {
  if (sellerUserId) {
    return `@${sellerUserId}`;
  }
  if (sellerName && !/^seller(\s+\d+)?$/i.test(sellerName)) {
    return sellerName;
  }
  return "";
}

function sellerAndTime(locale: Locale, sellerUserId?: string | null, sellerName?: string | null, publishedAt?: string) {
  const parts = [];
  const label = sellerLabel(sellerUserId, sellerName);
  if (label) {
    parts.push(label);
  }
  parts.push(formatDateTime(publishedAt, locale));
  return parts.join(" • ");
}

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const isArabic = locale === "ar";

  let data: PublicCarResponse | null = null;
  let fetchError = "";

  try {
    data = await apiGet<PublicCarResponse>(`/v1/public/cars/${id}`);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : isArabic ? "تعذر تحميل الإعلان." : "Failed to load listing.";
  }

  if (!data) {
    return (
      <main className="page shell">
        <div className="notice error">{fetchError || (isArabic ? "الإعلان غير موجود." : "Listing not found.")}</div>
        <div className="spaced-top">
          <Link href="/search" className="btn btn-secondary">{isArabic ? "العودة إلى البحث" : "Back to search"}</Link>
        </div>
      </main>
    );
  }

  const car = data.listing;

  return (
    <main className="page shell two-col">
      <section className="panel">
        <header className="listing-head">
          <h1 className="listing-title">{car.title_ar}</h1>
          <div className="listing-price-row">
            <p className="car-price-meta">{sellerAndTime(locale, data.seller.user_id, data.seller.name, car.published_at)}</p>
            <p className="car-price">{formatPrice(car.price_sar, locale)}</p>
          </div>
          <OwnerActions ownerId={car.owner_id} carId={car.id} />
        </header>

        {car.photos?.length ? (
          <ListingPhotoGallery photos={car.photos} title={car.title_ar} />
        ) : (
          <div className="notice spaced-top-sm">{isArabic ? "لا توجد صور بعد." : "No photos yet."}</div>
        )}

        <div className="specs">
          <article className="spec">
            <p className="spec-key">{isArabic ? "الشركة" : "Make"}</p>
            <p className="spec-val">{translateValue(locale, specValue(car.make))}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "الموديل" : "Model"}</p>
            <p className="spec-val">{specValue(car.model)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "السنة" : "Year"}</p>
            <p className="spec-val">{specValue(car.year)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "الممشى" : "Mileage"}</p>
            <p className="spec-val">{car.mileage_km ? formatDistance(car.mileage_km, locale) : "—"}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "المدينة" : "City"}</p>
            <p className="spec-val">{specValue(car.city)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "الحي" : "District"}</p>
            <p className="spec-val">{specValue(car.district)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "ناقل الحركة" : "Transmission"}</p>
            <p className="spec-val">{translateValue(locale, car.transmission)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "الوقود" : "Fuel"}</p>
            <p className="spec-val">{translateValue(locale, car.fuel_type)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "نوع الهيكل" : "Body Type"}</p>
            <p className="spec-val">{translateValue(locale, car.body_type)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "الحالة" : "Condition"}</p>
            <p className="spec-val">{translateValue(locale, car.condition)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">{isArabic ? "اللون" : "Color"}</p>
            <p className="spec-val">{translateValue(locale, car.color)}</p>
          </article>
        </div>

        <div className="panel panel-soft">
          <h2 className="subheading">{isArabic ? "الوصف" : "Description"}</h2>
          <p className="body-copy">{car.description_ar}</p>
        </div>
      </section>

      <aside className="panel">
        <h2 className="subheading">{isArabic ? "التواصل مع البائع" : "Contact Seller"}</h2>
        {sellerLabel(data.seller.user_id, data.seller.name) ? (
          <p className="car-meta">{sellerLabel(data.seller.user_id, data.seller.name)}</p>
        ) : null}
        <div className="contact-actions">
          {data.contact.call_phone_e164 && (
            <a href={`tel:${data.contact.call_phone_e164}`} className="btn btn-secondary">
              {isArabic ? "اتصل بالبائع" : "Call Seller"}
            </a>
          )}

          {data.contact.whatsapp_url && (
            <a href={data.contact.whatsapp_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
              {isArabic ? "افتح واتساب" : "Open WhatsApp"}
            </a>
          )}
        </div>

        <hr className="separator" />

        <h3 className="subheading">{isArabic ? "المحادثة داخل الموقع" : "In-App Chat"}</h3>
        <ChatPanel carId={car.id} />
      </aside>
    </main>
  );
}
