import Link from "next/link";

import { apiGet } from "@/lib/api";
import ListingPhotoGallery from "@/components/ListingPhotoGallery";
import { formatDateTime, formatDistance, formatListingPrice, translateValue, type Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import { getNiche, nicheBadges, nicheScore, nicheScoreLabel } from "@/shared/niches";
import ChatPanel from "./ChatPanel";
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
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price_sar?: number | null;
  mileage_km?: number;
  title_ar: string;
  description_ar: string;
  public_bidding_enabled: boolean;
  transmission?: string;
  fuel_type?: string;
  body_type?: string;
  drivetrain?: string;
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
  const nicheBadgesForCar = nicheBadges(car, locale, selectedNiche.id);

  return (
    <main className="page shell two-col">
      <section className="panel">
        <header className="listing-head">
          <h1 className="listing-title">{car.title_ar}</h1>
          <div className="listing-price-row">
            <p className="car-price-meta">{sellerAndTime(locale, data.seller.user_id, data.seller.name, car.published_at)}</p>
            <p className="car-price">{formatListingPrice(car.price_sar, locale)}</p>
          </div>
          <OwnerActions ownerId={car.owner_id} carId={car.id} />
        </header>

        {car.photos?.length ? (
          <ListingPhotoGallery photos={car.photos} title={car.title_ar} />
        ) : (
          <div className="notice spaced-top-sm">No photos yet.</div>
        )}

        <div className="specs">
          <article className="spec">
            <p className="spec-key">Make</p>
            <p className="spec-val">{translateValue(locale, specValue(car.make))}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Model</p>
            <p className="spec-val">{specValue(car.model)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Year</p>
            <p className="spec-val">{specValue(car.year)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Mileage</p>
            <p className="spec-val">{car.mileage_km ? formatDistance(car.mileage_km, locale) : "—"}</p>
          </article>
          <article className="spec">
            <p className="spec-key">City</p>
            <p className="spec-val">{specValue(car.city)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">District</p>
            <p className="spec-val">{specValue(car.district)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Transmission</p>
            <p className="spec-val">{translateValue(locale, car.transmission)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Fuel</p>
            <p className="spec-val">{translateValue(locale, car.fuel_type)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Drivetrain</p>
            <p className="spec-val">{translateValue(locale, car.drivetrain)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Body Type</p>
            <p className="spec-val">{translateValue(locale, car.body_type)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Condition</p>
            <p className="spec-val">{translateValue(locale, car.condition)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Color</p>
            <p className="spec-val">{translateValue(locale, car.color)}</p>
          </article>
        </div>

        <div className="panel panel-soft winter-detail-card">
          <div>
            <p className="spec-key">{selectedNiche.scoreLabel}</p>
            <h2 className="subheading">{nicheScoreLabel(car, selectedNiche.id)}</h2>
            <p className="body-copy">
              Scored {nicheScore(car, selectedNiche.id)}/10 from niche signals like drivetrain, fuel type,
              price, mileage, body style, and seller notes.
            </p>
          </div>
          <div className="winter-chip-row" aria-label="Niche signals">
            {nicheBadgesForCar.map((badge) => (
              <span className="winter-chip" key={badge}>{badge}</span>
            ))}
          </div>
        </div>

        <div className="panel panel-soft">
          <h2 className="subheading">Description</h2>
          <p className="body-copy">{car.description_ar}</p>
        </div>
      </section>

      <aside className="panel">
        <h2 className="subheading">Contact Seller</h2>
        {sellerLabel(data.seller.user_id, data.seller.name) ? (
          <p className="car-meta">{sellerLabel(data.seller.user_id, data.seller.name)}</p>
        ) : null}
        <div className="contact-actions">
          {data.contact.call_phone_e164 && (
            <a href={`tel:${data.contact.call_phone_e164}`} className="btn btn-secondary">
              Call Seller
            </a>
          )}

          {data.contact.whatsapp_url && (
            <a href={data.contact.whatsapp_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
              Open WhatsApp
            </a>
          )}
        </div>

        <hr className="separator" />

        <OfferForm carId={car.id} ownerId={car.owner_id} publicBiddingEnabled={car.public_bidding_enabled} />

        <hr className="separator" />

        <h3 className="subheading">Comments</h3>
        <ChatPanel carId={car.id} />
      </aside>
    </main>
  );
}
