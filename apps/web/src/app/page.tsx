import Link from "next/link";

import { apiGet } from "@/lib/api";
import HomeListingCard from "@/components/HomeListingCard";
import { formatListingPrice, formatMileage, formatRelativeHours, type Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";

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
  title_ar: string;
  published_at?: string;
  photos?: Array<{ public_url: string }>;
};

type HomeSearchResponse = {
  items: HomeListing[];
};

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

export default async function HomePage() {
  const locale = await getServerLocale();
  let listings: HomeListing[] = [];
  let fetchError = "";

  try {
    const data = await apiGet<HomeSearchResponse>("/v1/search/cars?page_size=8");
    listings = data.items ?? [];
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load listings.";
  }

  const loadedCount = listings.length;

  return (
    <main className="page shell">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-hero-topline">
            <span className="home-hero-badge">U.S. Car Marketplace</span>
          </div>

          <h2 className="home-hero-title">
            <span className="home-hero-title-accent">List your car fast.</span>
          </h2>

          <p className="home-hero-sub">
            Using AI to detect car details and pricing.
          </p>

          <div className="hero-actions home-hero-actions">
            <Link href="/search" className="btn btn-primary">Browse Listings</Link>
            <Link href="/my-cars/new" className="btn btn-secondary">Sell Your Car</Link>
          </div>
        </div>
      </section>

      <h2 className="section-title">Latest Listings</h2>

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
                photos={car.photos}
              />
            );
          })}
        </section>
      )}
    </main>
  );
}
