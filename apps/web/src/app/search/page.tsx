import Link from "next/link";

import { apiGet } from "@/lib/api";
import CityField from "@/components/CityField";
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
import { winterBadges, winterScoreLabel } from "@/shared/winter";

type SearchItem = {
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

type SearchResponse = {
  page: number;
  page_size: number;
  total: number;
  items: SearchItem[];
};

type Query = {
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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const params = await searchParams;
  const locale = await getServerLocale();
  const radiusKm = Number(params.radius_km);
  const initialRadiusKm = Number.isFinite(radiusKm) && radiusKm >= 1 && radiusKm <= 500 ? radiusKm : 50;

  const qs = new URLSearchParams();
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
  if (params.radius_km) qs.set("radius_km", params.radius_km);

  const path = qs.toString() ? `/v1/search/cars?${qs.toString()}` : "/v1/search/cars";

  let data: SearchResponse = { page: 1, page_size: 20, total: 0, items: [] };
  let fetchError = "";

  try {
    data = await apiGet<SearchResponse>(path);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load search results.";
  }

  return (
    <main className="page shell">
      <section className="hero hero-mini">
        <p className="hero-kicker">AutoIntel Niche Search</p>
        <h1>Search by use case</h1>
        <p>Start with cold-weather commuter signals: traction, fuel, mileage, price, body, and distance.</p>
        <div className="hero-actions">
          <Link href="/search?city=Buffalo&price_max=30000&drivetrain=AWD" className="btn btn-secondary">AWD under $30k</Link>
          <Link href="/search?city=Buffalo&fuel_type=Hybrid&price_max=30000" className="btn btn-secondary">Hybrids under $30k</Link>
          <Link href="/search?city=Buffalo&fuel_type=Electric&price_max=30000" className="btn btn-secondary">Used EVs</Link>
        </div>
      </section>

      <section className="search-grid">
        <aside className="panel">
          <form className="filters" method="get">
            <NearbySearch initialRadiusKm={initialRadiusKm} />
            {params.lat ? <input type="hidden" name="lat" value={params.lat} /> : null}
            {params.lon ? <input type="hidden" name="lon" value={params.lon} /> : null}
            {params.radius_km ? <input type="hidden" name="radius_km" value={params.radius_km} /> : null}
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
                <input id="price_max" name="price_max" defaultValue={params.price_max ?? "30000"} placeholder="30000" className="input" inputMode="numeric" />
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
        </aside>

        <section>
          <div className="panel panel-compact">
            <strong>{data.total}</strong> cars found
          </div>

          {fetchError ? (
            <div className="notice error">{fetchError}</div>
          ) : data.items.length === 0 ? (
            <div className="notice">No cars match those filters.</div>
          ) : (
            <div className="listing-grid">
              {data.items.map((car) => {
                const cover = car.photos?.[0]?.public_url ?? "";
                const badges = winterBadges(car, locale);
                return (
                  <Link key={car.id} href={`/cars/${car.id}`} className="car-card">
                    {cover ? (
                      <img className="car-thumb" src={cover} alt={car.title_ar || `${car.make} ${car.model}`} />
                    ) : (
                      <div className="car-thumb" aria-hidden="true" />
                    )}
                    <div className="car-body">
                      <h3 className="car-title">{car.title_ar || `${car.make} ${car.model}`}</h3>
                      <p className="winter-score-pill">{winterScoreLabel(car)}</p>
                      <p className="car-meta">{car.make} {car.model} • {car.year}</p>
                      <p className="car-meta">{formatMileage(car.mileage_km, locale)}</p>
                      <p className="car-meta">
                        {[translateValue(locale, car.fuel_type), translateValue(locale, car.drivetrain), translateValue(locale, car.body_type)]
                          .filter((value) => value !== "—")
                          .join(" • ") || "Specs not set"}
                      </p>
                      <div className="winter-chip-row" aria-label="Niche signals">
                        {badges.map((badge) => (
                          <span className="winter-chip" key={badge}>{badge}</span>
                        ))}
                      </div>
                      <div className="car-footer-row">
                        <p className="car-price">{formatListingPrice(car.price_sar, locale)}</p>
                        <p className="car-footer-meta">{locationUserAndTime(locale, car.city, car.district, car.seller_user_id, car.published_at)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
