import { apiGet } from "@/lib/api";
import HomeListingCard from "@/components/HomeListingCard";
import HomeFilterControls from "@/components/HomeFilterControls";
import { formatListingPrice, formatMileage, formatRelativeHours, type Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import { getNiche, nicheBadges, nicheScoreLabel, type NicheScoreResult } from "@/shared/niches";

type HomeListing = {
  id: number | string;
  owner_id?: number;
  seller_user_id?: string;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price?: number | null;
  mileage?: number;
  fuel_type?: string;
  drivetrain?: string;
  body_type?: string;
  condition?: string;
  title: string;
  description?: string;
  published_at?: string;
  photos?: Array<{ id?: number; public_url: string; sort_order?: number; is_cover?: boolean }>;
  niche_scores?: Record<string, NicheScoreResult>;
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
  sort?: string;
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
  if (params.sort) qs.set("sort", params.sort);
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
    params.sort ||
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
          <h1 className="home-hero-title">
            <span>Sell your car faster.</span>
            <span className="home-hero-title-accent">List it smarter.</span>
          </h1>
          <p className="home-hero-sub">
            AutoIntel helps you turn vehicle details, VIN data, and market signals into a clean listing buyers can trust.
          </p>
        </div>

        <div className="home-hero-rail" aria-label="Homepage filters">
          <HomeFilterControls params={params} />
        </div>
      </section>

      <h2 id="listings" className="section-title">{isFiltered ? `${selectedNiche.shortName} matches` : "Fresh listings"}</h2>

      {fetchError ? (
        <div className="notice error">{fetchError}</div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <h3>No matching cars yet</h3>
          <p>Try another filter set or start a listing if you are ready to sell.</p>
          <div className="hero-actions">
            <a href="/search" className="btn btn-secondary">Browse all cars</a>
            <a href="/my-cars/new" className="btn btn-primary">Sell your car</a>
          </div>
        </div>
      ) : (
        <section className="listing-grid">
          {listings.map((car) => {
            return (
              <HomeListingCard
                key={car.id}
                href={`/cars/${car.id}?niche=${selectedNiche.id}`}
                title={car.title || `${car.make} ${car.model}`}
                make={car.make}
                model={car.model}
                year={car.year}
                mileageText={formatMileage(car.mileage, locale)}
                priceText={formatListingPrice(car.price, locale)}
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
