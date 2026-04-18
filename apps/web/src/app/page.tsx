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
            <Link href="/search?city=Buffalo&price_max=30000" className="btn btn-primary">Browse Launch Niche</Link>
            <Link href="/my-cars/new" className="btn btn-secondary">List a Car</Link>
          </div>

          <nav className="home-quick-filters" aria-label="Quick filters">
            <p className="home-quick-filters-label">Quick filters</p>
            <div className="home-quick-filter-list">
              <Link href="/search?price_max=30000">Under $30k</Link>
              <Link href="/search?drivetrain=AWD">AWD</Link>
              <Link href="/search?drivetrain=4WD">4WD</Link>
              <Link href="/search?fuel_type=Hybrid">Hybrids</Link>
              <Link href="/search?fuel_type=Electric">EVs</Link>
              <Link href="/search?mileage_max=100000">Under 100k mi</Link>
              <Link href="/search?body_type=SUV">SUVs</Link>
              <Link href="/search?city=Buffalo">Buffalo</Link>
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

      <h2 className="section-title">Latest Curated Listings</h2>

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
