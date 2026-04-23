import { apiGet } from "@/lib/api";
import HomeListingCard from "@/components/HomeListingCard";
import HomeFilterControls from "@/components/HomeFilterControls";
import { formatListingPrice, formatMileage, formatRelativeHours, type Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import { getNiche, nicheBadges, nicheScoreLabel } from "@/shared/niches";

type HomeListing = {
  id: number | string;
  owner_id?: number;
  seller_user_id?: string;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price_sar?: number | null;
  mileage_km?: number;
  fuel_type?: string;
  drivetrain?: string;
  body_type?: string;
  condition?: string;
  title_ar: string;
  description_ar?: string;
  published_at?: string;
  photos?: Array<{ public_url: string }>;
};

type HomeSearchResponse = {
  items: HomeListing[];
};

type Query = {
  niche?: string;
  city?: string;
  q?: string;
  price_max?: string;
  mileage_max?: string;
  fuel_type?: string;
  drivetrain?: string;
  body_type?: string;
  lat?: string;
  lon?: string;
  radius_km?: string;
};

const MILES_TO_KM = 1.60934;

function locationUserAndTime(locale: Locale, city?: string, district?: string, sellerUserId?: string, publishedAt?: string) {
  const parts = [];
  if (district && city) {
    parts.push(`${district}, ${city}`);
  } else if (city) {
    parts.push(city);
  }
  if (sellerUserId) {
    parts.push(`@${sellerUserId}`);
  }
  parts.push(formatRelativeHours(publishedAt, locale));
  return parts.join(" • ");
}

function buildHomeSearchPath(params: Query): string {
  const qs = new URLSearchParams({ page_size: "8" });
  if (params.city) qs.set("city", params.city);
  if (params.q) qs.set("q", params.q);
  if (params.price_max) qs.set("price_max", params.price_max);
  if (params.mileage_max) {
    const mileageMaxMiles = Number(params.mileage_max);
    if (Number.isFinite(mileageMaxMiles) && mileageMaxMiles >= 0) {
      qs.set("mileage_max", String(Math.round(mileageMaxMiles * MILES_TO_KM)));
    }
  }
  if (params.fuel_type) qs.set("fuel_type", params.fuel_type);
  if (params.drivetrain) qs.set("drivetrain", params.drivetrain);
  if (params.body_type) qs.set("body_type", params.body_type);
  if (params.lat) qs.set("lat", params.lat);
  if (params.lon) qs.set("lon", params.lon);
  if (params.radius_km) qs.set("radius_km", params.radius_km);
  return `/v1/search/cars?${qs.toString()}`;
}

function hasHomeFilters(params: Query): boolean {
  return Boolean(
    params.niche ||
    params.city ||
    params.q ||
    params.price_max ||
    params.mileage_max ||
    params.fuel_type ||
    params.drivetrain ||
    params.body_type ||
    (params.lat && params.lon)
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const params = await searchParams;
  const locale = await getServerLocale();
  const selectedNiche = getNiche(params.niche);
  let listings: HomeListing[] = [];
  let fetchError = "";
  const isFiltered = hasHomeFilters(params);

  try {
    const data = await apiGet<HomeSearchResponse>(buildHomeSearchPath(params));
    listings = data.items ?? [];
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load listings.";
  }

  return (
    <main className="page shell">
      <section className="home-hero">
        <div className="home-hero-copy">
          <h2 className="home-hero-title">
            <span>Find cars by real use case.</span>
            <span className="home-hero-title-accent">List without the drag.</span>
          </h2>
          <p className="home-hero-sub">
            AutoIntel turns messy car listings into clear niche scores. Pick a niche,
            then compare cars by the details that matter for that use case.
          </p>

          <HomeFilterControls params={params} />
        </div>

        <div className="home-hero-rail" aria-label="AutoIntel niche signals">
          <article className="home-hero-stat">
            <p className="home-hero-stat-label">Launch Niche</p>
            <p className="home-hero-stat-value">{selectedNiche.name}</p>
            <p className="home-hero-stat-note">{selectedNiche.intro}</p>
            <div className="home-hero-signal-list" aria-label="Niche signals">
              {selectedNiche.signals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <h2 id="listings" className="section-title">{isFiltered ? `${selectedNiche.shortName} Matches` : "Fresh Niche Listings"}</h2>

      {fetchError ? (
        <div className="notice error">{fetchError}</div>
      ) : listings.length === 0 ? (
        <div className="notice">No niche matches yet.</div>
      ) : (
        <section className="listing-grid">
          {listings.map((car) => {
            return (
              <HomeListingCard
                key={car.id}
                href={`/cars/${car.id}?niche=${selectedNiche.id}`}
                title={car.title_ar || `${car.make} ${car.model}`}
                make={car.make}
                model={car.model}
                year={car.year}
                mileageText={formatMileage(car.mileage_km, locale)}
                priceText={formatListingPrice(car.price_sar, locale)}
                metaText={locationUserAndTime(locale, car.city, car.district, car.seller_user_id, car.published_at)}
                winterLabel={nicheScoreLabel(car, selectedNiche.id)}
                badges={nicheBadges(car, locale, selectedNiche.id)}
                photos={car.photos}
              />
            );
          })}
        </section>
      )}
    </main>
  );
}
