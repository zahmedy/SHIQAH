import Link from "next/link";

import { apiGet } from "@/lib/api";
import HomeListingCard from "@/components/HomeListingCard";
import { formatListingPrice, formatMileage, formatRelativeHours, type Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import { winterBadges, winterScoreLabel } from "@/shared/winter";

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
  title_ar: string;
  description_ar?: string;
  published_at?: string;
  photos?: Array<{ public_url: string }>;
};

type HomeSearchResponse = {
  items: HomeListing[];
};

type Query = {
  city?: string;
  q?: string;
  price_max?: string;
  mileage_max?: string;
  fuel_type?: string;
  drivetrain?: string;
  body_type?: string;
};

const MILES_TO_KM = 1.60934;
const FUEL_TYPE_OPTIONS = [
  ["Hybrid", "Hybrid"],
  ["Electric", "Electric"],
  ["Petrol", "Gasoline"],
] as const;
const DRIVETRAIN_OPTIONS = ["AWD", "4WD", "FWD", "RWD"] as const;
const BODY_TYPE_OPTIONS = ["SUV", "Hatchback", "Sedan", "Pickup", "Van"] as const;

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
  return `/v1/search/cars?${qs.toString()}`;
}

function hasHomeFilters(params: Query): boolean {
  return Boolean(params.city || params.q || params.price_max || params.mileage_max || params.fuel_type || params.drivetrain || params.body_type);
}

function homeFilterHref(params: Query, key: keyof Query, value: string): string {
  const next = new URLSearchParams();
  const entries: Array<[keyof Query, string | undefined]> = [
    ["city", params.city],
    ["q", params.q],
    ["price_max", params.price_max],
    ["mileage_max", params.mileage_max],
    ["fuel_type", params.fuel_type],
    ["drivetrain", params.drivetrain],
    ["body_type", params.body_type],
  ];

  for (const [entryKey, entryValue] of entries) {
    if (entryValue && !(entryKey === key && entryValue === value)) {
      next.set(entryKey, entryValue);
    }
  }

  if (params[key] !== value) {
    next.set(key, value);
  }

  const qs = next.toString();
  return qs ? `/?${qs}` : "/";
}

function isHomeFilterActive(params: Query, key: keyof Query, value: string): boolean {
  return params[key] === value;
}

function quickFilterClass(params: Query, key: keyof Query, value: string): string {
  return isHomeFilterActive(params, key, value)
    ? "home-quick-filter-active"
    : "";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const params = await searchParams;
  const locale = await getServerLocale();
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
          <div className="home-hero-topline">
            <span className="home-hero-badge">Curated Used Cars</span>
            <span className="home-hero-marker">Starting with cold-weather commuter cars</span>
          </div>

          <h2 className="home-hero-title">
            <span className="home-hero-title-accent">Find the right car by niche, not endless listings.</span>
          </h2>

          <p className="home-hero-sub">
            AutoIntel helps buyers search by use case. Our first launch niche is
            affordable cold-weather commuters in Buffalo, with more niches coming next.
          </p>

          <div className="hero-actions home-hero-actions">
            <Link href="/?city=Buffalo&price_max=30000" className="btn btn-primary">Browse Launch Niche</Link>
            <Link href="/my-cars/new" className="btn btn-secondary">List a Car</Link>
          </div>

          <form className="home-filter-form" method="get" action="/">
            <input name="q" defaultValue={params.q ?? ""} className="input" placeholder="Keyword" aria-label="Keyword" />
            <input name="city" defaultValue={params.city ?? ""} className="input" placeholder="City" aria-label="City" />
            <input name="price_max" defaultValue={params.price_max ?? ""} className="input" inputMode="numeric" placeholder="Max $" aria-label="Max price" />
            <select name="fuel_type" defaultValue={params.fuel_type ?? ""} className="select" aria-label="Fuel type">
              <option value="">Any fuel</option>
              {FUEL_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select name="drivetrain" defaultValue={params.drivetrain ?? ""} className="select" aria-label="Drivetrain">
              <option value="">Any drive</option>
              {DRIVETRAIN_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select name="body_type" defaultValue={params.body_type ?? ""} className="select" aria-label="Body type">
              <option value="">Any body</option>
              {BODY_TYPE_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary">Filter</button>
            {isFiltered ? <Link href="/" className="btn btn-secondary">Clear</Link> : null}
          </form>

          <nav className="home-quick-filters" aria-label="Quick filters">
            <p className="home-quick-filters-label">Quick filters</p>
            <div className="home-quick-filter-list">
              <Link href={homeFilterHref(params, "price_max", "30000")} className={quickFilterClass(params, "price_max", "30000")} aria-current={isHomeFilterActive(params, "price_max", "30000") ? "true" : undefined}>Under $30k</Link>
              <Link href={homeFilterHref(params, "drivetrain", "AWD")} className={quickFilterClass(params, "drivetrain", "AWD")} aria-current={isHomeFilterActive(params, "drivetrain", "AWD") ? "true" : undefined}>AWD</Link>
              <Link href={homeFilterHref(params, "drivetrain", "4WD")} className={quickFilterClass(params, "drivetrain", "4WD")} aria-current={isHomeFilterActive(params, "drivetrain", "4WD") ? "true" : undefined}>4WD</Link>
              <Link href={homeFilterHref(params, "fuel_type", "Hybrid")} className={quickFilterClass(params, "fuel_type", "Hybrid")} aria-current={isHomeFilterActive(params, "fuel_type", "Hybrid") ? "true" : undefined}>Hybrids</Link>
              <Link href={homeFilterHref(params, "fuel_type", "Electric")} className={quickFilterClass(params, "fuel_type", "Electric")} aria-current={isHomeFilterActive(params, "fuel_type", "Electric") ? "true" : undefined}>EVs</Link>
              <Link href={homeFilterHref(params, "mileage_max", "100000")} className={quickFilterClass(params, "mileage_max", "100000")} aria-current={isHomeFilterActive(params, "mileage_max", "100000") ? "true" : undefined}>Under 100k mi</Link>
              <Link href={homeFilterHref(params, "body_type", "SUV")} className={quickFilterClass(params, "body_type", "SUV")} aria-current={isHomeFilterActive(params, "body_type", "SUV") ? "true" : undefined}>SUVs</Link>
              <Link href={homeFilterHref(params, "city", "Buffalo")} className={quickFilterClass(params, "city", "Buffalo")} aria-current={isHomeFilterActive(params, "city", "Buffalo") ? "true" : undefined}>Buffalo</Link>
            </div>
          </nav>
        </div>

        <div className="home-hero-rail" aria-label="Marketplace focus">
          <article className="home-hero-stat">
            <p className="home-hero-stat-label">Launch Niche</p>
            <p className="home-hero-stat-value">Cold Weather</p>
            <p className="home-hero-stat-note">Traction, snow tires, heated seats, rust notes, efficient commuters, and practical body styles.</p>
          </article>
          <article className="home-hero-stat">
            <p className="home-hero-stat-label">Next Niches</p>
            <p className="home-hero-stat-value">Performance</p>
            <p className="home-hero-stat-note">Sports cars, luxury, EVs, work trucks, and local city pages can plug into the same marketplace.</p>
          </article>
        </div>
      </section>

      <h2 className="section-title">{isFiltered ? "Filtered Listings" : "Latest Curated Listings"}</h2>

      {fetchError ? (
        <div className="notice error">{fetchError}</div>
      ) : listings.length === 0 ? (
        <div className="notice">No listings available yet.</div>
      ) : (
        <section className="listing-grid">
          {listings.map((car) => {
            return (
              <HomeListingCard
                key={car.id}
                href={`/cars/${car.id}`}
                title={car.title_ar || `${car.make} ${car.model}`}
                make={car.make}
                model={car.model}
                year={car.year}
                mileageText={formatMileage(car.mileage_km, locale)}
                priceText={formatListingPrice(car.price_sar, locale)}
                metaText={locationUserAndTime(locale, car.city, car.district, car.seller_user_id, car.published_at)}
                winterLabel={winterScoreLabel(car)}
                badges={winterBadges(car, locale)}
                photos={car.photos}
              />
            );
          })}
        </section>
      )}
    </main>
  );
}
