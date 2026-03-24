import Link from "next/link";

import { apiGet } from "@/lib/api";
import CityField from "@/components/CityField";
import NearbySearch from "@/components/NearbySearch";

type SearchItem = {
  id: number | string;
  owner_id?: number;
  seller_user_id?: string;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price_sar: number;
  mileage_km?: number;
  title_ar: string;
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
  lat?: string;
  lon?: string;
  radius_km?: string;
};

const priceFormatter = new Intl.NumberFormat("en-US");

function formatHoursAgo(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const diffHours = Math.max(1, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
  return `${diffHours}h ago`;
}

function locationUserAndTime(city?: string, district?: string, sellerUserId?: string, publishedAt?: string) {
  const parts = [];
  if (district && city) {
    parts.push(`${district}, ${city}`);
  } else if (city) {
    parts.push(city);
  }
  if (sellerUserId) {
    parts.push(`@${sellerUserId}`);
  }
  parts.push(formatHoursAgo(publishedAt));
  return parts.join(" • ");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const params = await searchParams;
  const radiusKm = Number(params.radius_km);
  const initialRadiusKm = Number.isFinite(radiusKm) && radiusKm >= 1 && radiusKm <= 500 ? radiusKm : 50;

  const qs = new URLSearchParams();
  if (params.city) qs.set("city", params.city);
  if (params.make) qs.set("make", params.make);
  if (params.model) qs.set("model", params.model);
  if (params.q) qs.set("q", params.q);
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
        <h1>Search Cars</h1>
        <p>Filter by city, make, model, or keywords in Arabic title/description.</p>
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
              <input id="q" name="q" defaultValue={params.q ?? ""} placeholder="كامري" className="input" />
            </div>

            <CityField
              id="city"
              label="City"
              name="city"
              defaultValue={params.city ?? ""}
              blankLabel="Any city"
              helperText="Pick a major city or choose Other to search a custom city."
              otherPlaceholder="Enter another city"
            />

            <div>
              <label className="label" htmlFor="make">Make</label>
              <input id="make" name="make" defaultValue={params.make ?? ""} placeholder="Toyota" className="input" />
            </div>

            <div>
              <label className="label" htmlFor="model">Model</label>
              <input id="model" name="model" defaultValue={params.model ?? ""} placeholder="Camry" className="input" />
            </div>

            <button type="submit" className="btn btn-primary">Apply Filters</button>
          </form>
        </aside>

        <section>
          <div className="panel panel-compact">
            <strong>{data.total}</strong> listings found
          </div>

          {fetchError ? (
            <div className="notice error">{fetchError}</div>
          ) : data.items.length === 0 ? (
            <div className="notice">No listings matched your filters.</div>
          ) : (
            <div className="listing-grid">
              {data.items.map((car) => {
                const cover = car.photos?.[0]?.public_url ?? "";
                return (
                  <Link key={car.id} href={`/cars/${car.id}`} className="car-card">
                    {cover ? (
                      <img className="car-thumb" src={cover} alt={car.title_ar || `${car.make} ${car.model}`} />
                    ) : (
                      <div className="car-thumb" aria-hidden="true" />
                    )}
                    <div className="car-body">
                      <h3 className="car-title">{car.title_ar || `${car.make} ${car.model}`}</h3>
                      <p className="car-meta">{car.make} {car.model} • {car.year}</p>
                      <p className="car-meta">{car.mileage_km ? `${car.mileage_km.toLocaleString()} km` : "Mileage not set"}</p>
                      <div className="car-footer-row">
                        <p className="car-price">{priceFormatter.format(car.price_sar)} SAR</p>
                        <p className="car-footer-meta">{locationUserAndTime(car.city, car.district, car.seller_user_id, car.published_at)}</p>
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
