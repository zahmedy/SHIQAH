import { formatDistance, formatListingPrice, type Locale } from "@/lib/locale";

export type WinterListingSignal = {
  city?: string | null;
  price_sar?: number | null;
  mileage_km?: number | null;
  fuel_type?: string | null;
  drivetrain?: string | null;
  body_type?: string | null;
  description_ar?: string | null;
};

const AFFORDABLE_PRICE = 30000;
const LOW_MILEAGE_KM = 100000 * 1.60934;

function normalized(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function mentionsWinterReadiness(listing: WinterListingSignal): boolean {
  const text = normalized(listing.description_ar);
  return [
    "snow tire",
    "winter tire",
    "heated seat",
    "garage",
    "rust",
    "battery warranty",
    "remote start",
  ].some((term) => text.includes(term));
}

export function winterScore(listing: WinterListingSignal): number {
  let score = 0;
  const fuelType = normalized(listing.fuel_type);
  const drivetrain = normalized(listing.drivetrain);
  const bodyType = normalized(listing.body_type);
  const city = normalized(listing.city);

  if (city === "buffalo") score += 1;
  if (drivetrain === "awd" || drivetrain === "4wd") score += 3;
  if (fuelType === "hybrid" || fuelType === "electric") score += 2;
  if (bodyType === "suv" || bodyType === "hatchback" || bodyType === "pickup" || bodyType === "wagon") score += 1;
  if (listing.price_sar !== undefined && listing.price_sar !== null && listing.price_sar <= AFFORDABLE_PRICE) score += 2;
  if (listing.mileage_km !== undefined && listing.mileage_km !== null && listing.mileage_km <= LOW_MILEAGE_KM) score += 1;
  if (mentionsWinterReadiness(listing)) score += 1;

  return Math.min(score, 10);
}

export function winterScoreLabel(listing: WinterListingSignal): string {
  const score = winterScore(listing);
  if (score >= 7) return "Strong cold-weather fit";
  if (score >= 4) return "Good commuter fit";
  return "Basic cold-weather fit";
}

export function winterBadges(listing: WinterListingSignal, locale: Locale): string[] {
  const badges: string[] = [];
  const drivetrain = normalized(listing.drivetrain);
  const fuelType = normalized(listing.fuel_type);

  if (drivetrain === "awd" || drivetrain === "4wd") badges.push(`${listing.drivetrain} winter traction`);
  if (fuelType === "hybrid" || fuelType === "electric") badges.push(`${listing.fuel_type} efficiency`);
  if (listing.price_sar !== undefined && listing.price_sar !== null && listing.price_sar <= AFFORDABLE_PRICE) {
    badges.push(`Under ${formatListingPrice(AFFORDABLE_PRICE, locale)}`);
  }
  if (listing.mileage_km !== undefined && listing.mileage_km !== null && listing.mileage_km <= LOW_MILEAGE_KM) {
    badges.push(`Under ${formatDistance(LOW_MILEAGE_KM, locale)}`);
  }

  if (badges.length === 0) {
    badges.push(winterScoreLabel(listing));
  }

  return badges.slice(0, 3);
}
