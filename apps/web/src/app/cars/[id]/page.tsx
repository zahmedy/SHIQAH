import Link from "next/link";

import { apiGet } from "@/lib/api";
import ListingPhotoGallery from "@/components/ListingPhotoGallery";
import NicheScoreSelector from "@/components/NicheScoreSelector";
import { formatDateTime, formatDistance, formatListingPrice, translateValue, type Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import { getNiche, type NicheScoreResult } from "@/shared/niches";
import ChatPanel from "./ChatPanel";
import ListingReportButton from "./ListingReportButton";
import OfferForm from "./OfferForm";
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
  status: string;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price?: number | null;
  sold_price?: number | null;
  mileage?: number;
  title: string;
  description: string;
  public_bidding_enabled: boolean;
  transmission?: string;
  fuel_type?: string;
  body_type?: string;
  drivetrain?: string;
  engine_cylinders?: number;
  engine_volume?: number;
  condition?: string;
  color?: string;
  published_at?: string;
  sold_at?: string | null;
  photos: Photo[];
  niche_scores?: Record<string, NicheScoreResult>;
};

type PublicCarResponse = {
  listing: Listing;
  seller: {
    id: number | null;
    name: string | null;
    user_id: string | null;
  };
  contact: {
    email_url: string | null;
    sms_url: string | null;
    whatsapp_url: string | null;
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

function SpecSection({
  title,
  items,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  items: { label: string; value: string | number }[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  if (collapsible) {
    return (
      <details className="listing-info-section listing-info-disclosure" open={defaultOpen}>
        <summary className="listing-section-title listing-section-summary">{title}</summary>
        <div className="specs">
          {items.map((item) => (
            <article className="spec" key={item.label}>
              <p className="spec-key">{item.label}</p>
              <p className="spec-val">{item.value}</p>
            </article>
          ))}
        </div>
      </details>
    );
  }

  return (
    <section className="listing-info-section">
      <h2 className="listing-section-title">{title}</h2>
      <div className="specs">
        {items.map((item) => (
          <article className="spec" key={item.label}>
            <p className="spec-key">{item.label}</p>
            <p className="spec-val">{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function CarDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ niche?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const locale = await getServerLocale();
  const selectedNiche = getNiche(query.niche);

  let data: PublicCarResponse | null = null;
  let fetchError = "";

  try {
    data = await apiGet<PublicCarResponse>(`/v1/public/cars/${id}`);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load listing.";
  }

  if (!data) {
    return (
      <main className="page shell">
        <div className="notice error">{fetchError || "Listing not found."}</div>
        <div className="spaced-top">
          <Link href={`/search?niche=${selectedNiche.id}`} className="btn btn-secondary">Back to search</Link>
        </div>
      </main>
    );
  }

  const car = data.listing;
  const vehicleDetails = [
    { label: "Make", value: translateValue(locale, specValue(car.make)) },
    { label: "Model", value: specValue(car.model) },
    { label: "Year", value: specValue(car.year) },
    { label: "Mileage", value: car.mileage ? formatDistance(car.mileage, locale) : "—" },
    { label: "City", value: specValue(car.city) },
    { label: "District", value: specValue(car.district) },
    { label: "Condition", value: translateValue(locale, car.condition) },
    { label: "Color", value: translateValue(locale, car.color) },
  ];
  const technicalSpecs = [
    { label: "Transmission", value: translateValue(locale, car.transmission) },
    { label: "Fuel", value: translateValue(locale, car.fuel_type) },
    { label: "Drivetrain", value: translateValue(locale, car.drivetrain) },
    { label: "Engine Cylinders", value: specValue(car.engine_cylinders) },
    { label: "Engine Volume", value: car.engine_volume ? `${car.engine_volume} L` : "—" },
    { label: "Body Type", value: translateValue(locale, car.body_type) },
  ];
  const sellerName = sellerLabel(data.seller.user_id, data.seller.name);

  return (
    <main className="page shell car-detail-page">
      <section className="panel car-detail-main">
        <div className="listing-report-top">
          <ListingReportButton carId={car.id} ownerId={car.owner_id} compact />
        </div>
        <header className="listing-head">
          <h1 className="listing-title">{car.title}</h1>
          <div className="listing-price-row">
            <p className="car-price-meta">{sellerAndTime(locale, data.seller.user_id, data.seller.name, car.published_at)}</p>
            <p className="car-price">{formatListingPrice(car.price, locale)}</p>
          </div>
          <OwnerActions ownerId={car.owner_id} carId={car.id} initialStatus={car.status} />
        </header>

        {car.photos?.length ? (
          <ListingPhotoGallery photos={car.photos} title={car.title} />
        ) : (
          <div className="notice spaced-top-sm">No photos yet.</div>
        )}

        <SpecSection title="Details" items={vehicleDetails} />
      </section>

      <aside className="panel car-detail-actions">
        <OfferForm carId={car.id} ownerId={car.owner_id} publicBiddingEnabled={car.public_bidding_enabled} />

        <hr className="separator" />

        <section>
          <h2 className="subheading">Contact</h2>
          {sellerName ? <p className="car-meta">{sellerName}</p> : null}
          <div className="contact-actions compact-contact-actions">
            {data.contact.email_url && <a href={data.contact.email_url} className="btn btn-secondary">Email</a>}
            {data.contact.sms_url && <a href={data.contact.sms_url} className="btn btn-secondary">Text</a>}
            {data.contact.whatsapp_url && (
              <a href={data.contact.whatsapp_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                WhatsApp
              </a>
            )}
          </div>
          {!data.contact.email_url && !data.contact.sms_url && !data.contact.whatsapp_url ? (
            <p className="helper-text spaced-top-sm">No direct contact enabled.</p>
          ) : null}
        </section>

        <hr className="separator" />

        <h3 className="subheading">Comments</h3>
        <ChatPanel carId={car.id} />
      </aside>

      <section className="panel car-detail-secondary">
        <SpecSection title="Specs" items={technicalSpecs} collapsible defaultOpen={false} />

        <details className="listing-info-section listing-info-disclosure car-secondary-disclosure">
          <summary className="listing-section-title listing-section-summary">Description</summary>
          <p className="body-copy">{car.description}</p>
        </details>

        <details className="listing-info-section listing-info-disclosure car-secondary-disclosure">
          <summary className="listing-section-title listing-section-summary">Fit score</summary>
          <NicheScoreSelector listing={car} locale={locale} initialNicheId={selectedNiche.id} />
        </details>
      </section>
    </main>
  );
}
