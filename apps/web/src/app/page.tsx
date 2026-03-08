import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import { apiGet } from "@/lib/api";

type HomeListing = {
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

type HomeSearchResponse = {
  items: HomeListing[];
};

const priceFormatter = new Intl.NumberFormat("en-US");

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
      <section className="hero hero-home">
        <div className="hero-logo-wrap">
          <LogoMark className="hero-logo" />
          <div>
            <p className="hero-kicker">Saudi Used-Car Network</p>
            <h1>Buy and Sell with a Dealer-Grade Experience</h1>
          </div>
        </div>
        <p>
          Built for speed and trust. Search live listings, open detailed pages,
          and send direct leads to sellers in seconds.
        </p>

        <div className="hero-actions">
          <Link href="/search" className="btn btn-primary">
            Browse Listings
          </Link>
          <Link href="/search?city=Riyadh" className="btn btn-secondary">
            Riyadh Inventory
          </Link>
        </div>
      </section>

      <h2 className="section-title">Platform Highlights</h2>
      <section className="stats">
        <article className="stat-card">
          <p className="stat-label">Search Engine</p>
          <p className="stat-value">OpenSearch Core</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Listing Details</p>
          <p className="stat-value">Rich Specs + Gallery</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Lead Capture</p>
          <p className="stat-value">Call + WhatsApp + Form</p>
        </article>
      </section>

      <h2 className="section-title">Latest Listings</h2>
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
