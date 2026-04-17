import Link from "next/link";

import { apiGet } from "@/lib/api";
import HomeListingCard from "@/components/HomeListingCard";
import { formatListingPrice, formatMileage, formatRelativeHours, type Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import { winterBadges, winterScoreLabel } from "@/lib/winter";

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
    const data = await apiGet<HomeSearchResponse>("/v1/search/cars?city=Buffalo&price_max=30000&page_size=8");
    listings = data.items ?? [];
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load listings.";
  }

  return (
    <main className="page shell">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-hero-topline">
            <span className="home-hero-badge">Buffalo Winter Cars</span>
            <span className="home-hero-marker">Hybrids, EVs, AWD, and commuter value</span>
          </div>

          <h2 className="home-hero-title">
            <span className="home-hero-title-accent">Find a car built for Buffalo winter.</span>
          </h2>

          <p className="home-hero-sub">
            Affordable local commuter cars with the details Buffalo buyers care about:
            traction, fuel savings, mileage, winter equipment, and real seller context.
          </p>

          <div className="hero-actions home-hero-actions">
            <Link href="/search?city=Buffalo&price_max=30000" className="btn btn-primary">Browse Buffalo Cars</Link>
            <Link href="/my-cars/new" className="btn btn-secondary">List a Winter-Ready Car</Link>
          </div>
        </div>

        <div className="home-hero-rail" aria-label="Marketplace focus">
          <article className="home-hero-stat">
            <p className="home-hero-stat-label">Winter Fit</p>
            <p className="home-hero-stat-value">AWD + 4WD</p>
            <p className="home-hero-stat-note">Surface traction, snow tires, heated seats, rust notes, and practical body styles.</p>
          </article>
          <article className="home-hero-stat">
            <p className="home-hero-stat-label">Commuter Cost</p>
            <p className="home-hero-stat-value">Under $30k</p>
            <p className="home-hero-stat-note">Hybrid, EV, and efficient gas options for daily drives around Western New York.</p>
          </article>
        </div>
      </section>

      <h2 className="section-title">Buffalo Winter-Ready Listings</h2>

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
