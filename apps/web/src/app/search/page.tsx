import Link from "next/link";

import { apiGet } from "@/lib/api";
import CityField from "@/components/CityField";
import HomeListingCard from "@/components/HomeListingCard";
import MakeModelField from "@/components/MakeModelField";
import NearbySearch from "@/components/NearbySearch";
import {
  formatListingPrice,
  formatMileage,
  formatRelativeHours,
  translateValue,
  type Locale,
} from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import {
  DEFAULT_NICHE_ID,
  getNiche,
  nicheBadges,
  nicheScoreLabel,
  type NicheScoreResult,
} from "@/shared/niches";

type SearchItem = {
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

type SearchResponse = {
  page: number;
  page_size: number;
  total: number;
  items: SearchItem[];
};

type Query = {
  niche?: string;
  city?: string;
  make?: string;
  model?: string;
  q?: string;
  price_max?: string;
  mileage_max?: string;
  fuel_type?: string;
  drivetrain?: string;
  body_type?: string;
  sort?: string;
  lat?: string;
  lon?: string;
  radius_mi?: string;
  radius_km?: string;
};

const MILES_TO_KM = 1.60934;
const FUEL_TYPE_OPTIONS = [
  ["Hybrid", "Hybrid"],
  ["Electric", "Electric"],
  ["Petrol", "Gasoline"],
] as const;
const DRIVETRAIN_OPTIONS = ["AWD", "4WD", "FWD", "RWD"] as const;
const BODY_TYPE_OPTIONS = ["SUV", "Hatchback", "Sedan", "Pickup", "Van", "Wagon", "Convertible"] as const;
const LOW_RESULT_THRESHOLD = 3;
const FILTER_KEYS = [
  "city",
  "make",
  "model",
  "q",
  "price_max",
  "mileage_max",
  "fuel_type",
  "drivetrain",
  "body_type",
  "sort",
  "lat",
  "lon",
  "radius_mi",
  "radius_km",
] as const;
const COUNTED_FILTER_KEYS = [
  "city",
  "make",
  "model",
  "q",
  "price_max",
  "mileage_max",
  "fuel_type",
  "drivetrain",
  "body_type",
] as const;

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

function hasActiveFilters(params: Query): boolean {
  if (params.niche && params.niche !== DEFAULT_NICHE_ID) return true;
  if (COUNTED_FILTER_KEYS.some((key) => Boolean(params[key]))) return true;
  if (params.sort && params.sort !== "newest") return true;
  return Boolean(params.lat || params.lon || params.radius_mi || params.radius_km);
}

function activeFilterCount(params: Query): number {
  let count = params.niche && params.niche !== DEFAULT_NICHE_ID ? 1 : 0;
  for (const key of COUNTED_FILTER_KEYS) {
    if (params[key]) {
      count += 1;
    }
  }
  if (params.sort && params.sort !== "newest") {
    count += 1;
  }
  if (params.lat || params.lon || params.radius_mi || params.radius_km) {
    count += 1;
  }
  return count;
}

function filterFormKey(params: Query): string {
  const query = new URLSearchParams();
  if (params.niche) query.set("niche", params.niche);
  for (const key of FILTER_KEYS) {
    const value = params[key];
    if (value) {
      query.set(key, value);
    }
  }
  return query.toString() || "empty";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const params = await searchParams;
  const locale = await getServerLocale();
  const selectedNiche = getNiche(params.niche);
  const radiusMi = Number(params.radius_mi);
  const oldRadiusKm = Number(params.radius_km);
  const initialRadiusMi = Number.isFinite(radiusMi) && radiusMi >= 1 && radiusMi <= 500
    ? radiusMi
    : Number.isFinite(oldRadiusKm) && oldRadiusKm >= 1 && oldRadiusKm <= 805
      ? Math.max(1, Math.round(oldRadiusKm / 1.60934))
      : 50;

  const qs = new URLSearchParams();
  if (params.niche) qs.set("niche", params.niche);
  if (params.city) qs.set("city", params.city);
  if (params.make) qs.set("make", params.make);
  if (params.model) qs.set("model", params.model);
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
  if (params.radius_mi) qs.set("radius_mi", params.radius_mi);
  else if (params.radius_km) qs.set("radius_km", params.radius_km);

  qs.delete("niche");
  const path = qs.toString() ? `/v1/search/cars?${qs.toString()}` : "/v1/search/cars";

  let data: SearchResponse = { page: 1, page_size: 20, total: 0, items: [] };
  let fetchError = "";

  try {
    data = await apiGet<SearchResponse>(path);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load search results.";
  }
  const resultCount = data.items.length;
  const showClearFilters = hasActiveFilters(params) && resultCount > 0 && resultCount <= LOW_RESULT_THRESHOLD;
  const filterCount = activeFilterCount(params);
  const formKey = filterFormKey(params);

  return (
    <main className="page shell">
      <section className="hero hero-mini search-hero">
        <p className="hero-kicker">Browse cars</p>
      </section>

      <section className="search-grid">
        <aside className="panel search-filter-card">
          <details className="search-filter-details">
            <summary className="search-filter-summary">
              <span>Search filters</span>
              <span>{filterCount > 0 ? `${filterCount} active` : "Refine results"}</span>
            </summary>
            <form key={formKey} className="filters" method="get">
              <input type="hidden" name="niche" value={selectedNiche.id} />
              <NearbySearch initialRadiusMi={initialRadiusMi} />
              {params.lat ? <input type="hidden" name="lat" value={params.lat} /> : null}
              {params.lon ? <input type="hidden" name="lon" value={params.lon} /> : null}
              {params.radius_mi ? <input type="hidden" name="radius_mi" value={params.radius_mi} /> : null}
              <div>
                <label className="label" htmlFor="q">Keyword</label>
                <input id="q" name="q" defaultValue={params.q ?? ""} placeholder="snow tires, heated seats, Bolt" className="input" />
              </div>

              <CityField
                id="city"
                label="City"
                name="city"
                defaultValue={params.city ?? ""}
                blankLabel="Any city"
                helperText="Search any city or use Nearby."
                otherPlaceholder="Enter another city"
              />

              <MakeModelField
                defaultMake={params.make ?? ""}
                defaultModel={params.model ?? ""}
              />

              <div className="form-grid form-grid-2">
                <div>
                  <label className="label" htmlFor="price_max">Max Price</label>
                  <input id="price_max" name="price_max" defaultValue={params.price_max ?? ""} placeholder="30000" className="input" inputMode="numeric" />
                </div>
                <div>
                  <label className="label" htmlFor="mileage_max">Max Mileage</label>
                  <input id="mileage_max" name="mileage_max" defaultValue={params.mileage_max ?? ""} placeholder="100000" className="input" inputMode="numeric" />
                </div>
              </div>

              <div className="form-grid form-grid-2">
                <div>
                  <label className="label" htmlFor="fuel_type">Fuel</label>
                  <select id="fuel_type" name="fuel_type" defaultValue={params.fuel_type ?? ""} className="select">
                    <option value="">Any fuel</option>
                    {FUEL_TYPE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="drivetrain">Drivetrain</label>
                  <select id="drivetrain" name="drivetrain" defaultValue={params.drivetrain ?? ""} className="select">
                    <option value="">Any drivetrain</option>
                    {DRIVETRAIN_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid form-grid-2">
                <div>
                  <label className="label" htmlFor="body_type">Body</label>
                  <select id="body_type" name="body_type" defaultValue={params.body_type ?? ""} className="select">
                    <option value="">Any body</option>
                    {BODY_TYPE_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sort">Sort</label>
                  <select id="sort" name="sort" defaultValue={params.sort ?? "newest"} className="select">
                    <option value="newest">Newest</option>
                    <option value="price_asc">Lowest price</option>
                    <option value="price_desc">Highest price</option>
                    <option value="mileage_asc">Lowest mileage</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary">Show Cars</button>
            </form>
          </details>
        </aside>

        <section>
          <div className="results-bar">
            <div>
              <strong>{resultCount}</strong> cars found
              <p>Sorted and filtered for a faster browse.</p>
            </div>
            {showClearFilters ? (
              <Link href="/search" className="btn btn-secondary">Clear filters</Link>
            ) : null}
          </div>

          {fetchError ? (
            <div className="notice error">{fetchError}</div>
          ) : data.items.length === 0 ? (
            <div className="empty-state">
              <h3>No cars match those filters</h3>
              <p>Try widening price, mileage, location, or body style.</p>
              <div className="hero-actions">
                <Link href="/search" className="btn btn-secondary">Clear filters</Link>
              </div>
            </div>
          ) : (
            <div className="listing-grid">
              {data.items.map((car) => {
                const badges = nicheBadges(car, locale, selectedNiche.id);
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
                    badges={[
                      ...badges,
                      [translateValue(locale, car.fuel_type), translateValue(locale, car.drivetrain), translateValue(locale, car.body_type)]
                        .filter((value) => value !== "—")
                        .join(" • "),
                    ].filter(Boolean)}
                    photos={car.photos}
                  />
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
