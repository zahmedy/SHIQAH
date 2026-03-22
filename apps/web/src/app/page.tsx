import Link from "next/link";
import { apiGet } from "@/lib/api";

type HomeListing = {
  id: number | string;
  seller_name?: string;
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

type HomeSearchResponse = {
  items: HomeListing[];
};

const priceFormatter = new Intl.NumberFormat("en-US");

function formatPostedAt(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HomePage() {
  let listings: HomeListing[] = [];
  let fetchError = "";

  try {
    const data = await apiGet<HomeSearchResponse>("/v1/search/cars?page_size=8");
    listings = data.items ?? [];
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load listings.";
  }

  return (
    <main className="page shell">
      <h1 className="section-title">Latest Listings</h1>
      {fetchError ? (
        <div className="notice error">{fetchError}</div>
      ) : listings.length === 0 ? (
        <div className="notice">No listings available yet.</div>
      ) : (
        <section className="listing-grid">
          {listings.map((car) => {
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
                  <p className="car-meta">By {car.seller_name || "Seller"} • Posted {formatPostedAt(car.published_at)}</p>
                  <p className="car-meta">{car.city}{car.district ? `, ${car.district}` : ""}</p>
                  <p className="car-meta">{car.mileage_km ? `${car.mileage_km.toLocaleString()} km` : "Mileage not set"}</p>
                  <p className="car-price">{priceFormatter.format(car.price_sar)} SAR</p>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
