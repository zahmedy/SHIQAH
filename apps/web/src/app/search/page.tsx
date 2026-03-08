import Link from "next/link";

import { apiGet } from "@/lib/api";

type SearchItem = {
  id: number | string;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price_sar: number;
  mileage_km?: number;
  title_ar: string;
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
};

const priceFormatter = new Intl.NumberFormat("en-US");

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const params = await searchParams;

  const qs = new URLSearchParams();
  if (params.city) qs.set("city", params.city);
  if (params.make) qs.set("make", params.make);
  if (params.model) qs.set("model", params.model);
  if (params.q) qs.set("q", params.q);

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
      <section className="hero" style={{ padding: "1.4rem" }}>
        <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}>Search Cars</h1>
        <p>Filter by city, make, model, or keywords in Arabic title/description.</p>
      </section>

      <section className="search-grid" style={{ marginTop: "1rem" }}>
        <aside className="panel">
          <form className="filters" method="get">
            <div>
              <label className="label" htmlFor="q">Keyword</label>
              <input id="q" name="q" defaultValue={params.q ?? ""} placeholder="كامري" className="input" />
            </div>

            <div>
              <label className="label" htmlFor="city">City</label>
              <input id="city" name="city" defaultValue={params.city ?? ""} placeholder="Riyadh" className="input" />
            </div>

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
          <div className="panel" style={{ marginBottom: "0.8rem" }}>
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
                      <p className="car-meta">{car.city}{car.district ? `, ${car.district}` : ""}</p>
                      <p className="car-meta">{car.mileage_km ? `${car.mileage_km.toLocaleString()} km` : "Mileage not set"}</p>
                      <p className="car-price">{priceFormatter.format(car.price_sar)} SAR</p>
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
