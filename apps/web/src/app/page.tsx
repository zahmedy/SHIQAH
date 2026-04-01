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
  const isArabic = locale === "ar";
  let listings: HomeListing[] = [];
  let fetchError = "";

  try {
    const data = await apiGet<HomeSearchResponse>("/v1/search/cars?page_size=8");
    listings = data.items ?? [];
  } catch (err) {
    fetchError = err instanceof Error ? err.message : isArabic ? "تعذر تحميل الإعلانات." : "Failed to load listings.";
  }

  return (
    <main className="page shell">
      <section className="home-hero">
        <span className="home-hero-badge">
          {isArabic ? "سوق سيارات السعودية" : "Saudi Arabia's Car Marketplace"}
        </span>
        <h1 className="home-hero-title">
          {isArabic ? "بيع واشترِ سيارتك" : "Buy & Sell Cars"}
        </h1>
        <p className="home-hero-sub">
          {isArabic
            ? "آلاف الإعلانات من جميع أنحاء المملكة"
            : "Thousands of listings from across the Kingdom"}
        </p>
      </section>

      <h2 className="section-title">{isArabic ? "أحدث السيارات" : "Latest Listings"}</h2>

      {fetchError ? (
        <div className="notice error">{fetchError}</div>
      ) : listings.length === 0 ? (
        <div className="notice">{isArabic ? "ما فيه إعلانات للحين." : "No listings available yet."}</div>
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
