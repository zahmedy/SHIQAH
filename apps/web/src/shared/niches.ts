import { formatDistance, formatListingPrice, type Locale } from "@/lib/locale";

export type NicheListingSignal = {
  city?: string | null;
  price_sar?: number | null;
  mileage_km?: number | null;
  fuel_type?: string | null;
  drivetrain?: string | null;
  body_type?: string | null;
  condition?: string | null;
  description_ar?: string | null;
};

export type NicheQuickFilter = {
  label: string;
  key: "price_max" | "mileage_max" | "fuel_type" | "drivetrain" | "body_type";
  value: string;
};

export type NicheDefinition = {
  id: string;
  name: string;
  shortName: string;
  intro: string;
  scoreLabel: string;
  signals: string[];
  quickFilters: NicheQuickFilter[];
  searchLinks: Array<{
    label: string;
    query: Record<string, string>;
  }>;
};

const AFFORDABLE_PRICE = 30000;
const BUDGET_PRICE = 15000;
const LOW_MILEAGE_MILES = 100000;
const DAILY_MILEAGE_MILES = 120000;
const LOW_MILEAGE_KM = LOW_MILEAGE_MILES * 1.60934;
const DAILY_MILEAGE_KM = DAILY_MILEAGE_MILES * 1.60934;

export const DEFAULT_NICHE_ID = "cold_weather_commuter";

export const NICHES: NicheDefinition[] = [
  {
    id: DEFAULT_NICHE_ID,
    name: "Cold-weather commuter",
    shortName: "Cold weather",
    intro: "Affordable cars for snow, cold starts, short commutes, and rough winter weeks.",
    scoreLabel: "Cold-weather fit",
    signals: ["AWD / 4WD", "Tires + rust", "Lower miles"],
    quickFilters: [
      { label: "Under $30k", key: "price_max", value: String(AFFORDABLE_PRICE) },
      { label: "AWD", key: "drivetrain", value: "AWD" },
      { label: "4WD", key: "drivetrain", value: "4WD" },
      { label: "Under 100k mi", key: "mileage_max", value: String(LOW_MILEAGE_MILES) },
      { label: "SUVs", key: "body_type", value: "SUV" },
      { label: "Wagons", key: "body_type", value: "Wagon" },
    ],
    searchLinks: [
      { label: "AWD under $30k", query: { price_max: String(AFFORDABLE_PRICE), drivetrain: "AWD" } },
      { label: "4WD under $30k", query: { price_max: String(AFFORDABLE_PRICE), drivetrain: "4WD" } },
      { label: "Wagons under 100k mi", query: { mileage_max: String(LOW_MILEAGE_MILES), body_type: "Wagon" } },
    ],
  },
  {
    id: "budget_daily_driver",
    name: "Budget daily driver",
    shortName: "Budget daily",
    intro: "Simple, affordable cars for daily errands, work commutes, and first-time buyers.",
    scoreLabel: "Daily-driver fit",
    signals: ["Low price", "Lower miles", "Easy body styles"],
    quickFilters: [
      { label: "Under $15k", key: "price_max", value: String(BUDGET_PRICE) },
      { label: "Under 120k mi", key: "mileage_max", value: String(DAILY_MILEAGE_MILES) },
      { label: "Sedans", key: "body_type", value: "Sedan" },
      { label: "Hatchbacks", key: "body_type", value: "Hatchback" },
      { label: "Hybrids", key: "fuel_type", value: "Hybrid" },
      { label: "EV", key: "fuel_type", value: "Electric" },
    ],
    searchLinks: [
      { label: "Under $15k", query: { price_max: String(BUDGET_PRICE) } },
      { label: "Under 120k mi", query: { mileage_max: String(DAILY_MILEAGE_MILES) } },
      { label: "Sedans under $15k", query: { price_max: String(BUDGET_PRICE), body_type: "Sedan" } },
    ],
  },
];

export function getNiche(id?: string | null): NicheDefinition {
  return NICHES.find((niche) => niche.id === id) ?? NICHES[0];
}

export function nicheHref(pathname: string, niche: NicheDefinition, query: Record<string, string> = {}): string {
  const qs = new URLSearchParams({ niche: niche.id, ...query });
  return `${pathname}?${qs.toString()}`;
}

function normalized(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function mentionsWinterReadiness(listing: NicheListingSignal): boolean {
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

function coldWeatherScore(listing: NicheListingSignal): number {
  let score = 0;
  const drivetrain = normalized(listing.drivetrain);
  const bodyType = normalized(listing.body_type);

  if (drivetrain === "awd" || drivetrain === "4wd") score += 3;
  if (bodyType === "suv" || bodyType === "hatchback" || bodyType === "pickup" || bodyType === "wagon") score += 1;
  if (listing.price_sar !== undefined && listing.price_sar !== null && listing.price_sar <= AFFORDABLE_PRICE) score += 2;
  if (listing.mileage_km !== undefined && listing.mileage_km !== null && listing.mileage_km <= LOW_MILEAGE_KM) score += 1;
  if (mentionsWinterReadiness(listing)) score += 1;

  return Math.min(score, 10);
}

function budgetDailyScore(listing: NicheListingSignal): number {
  let score = 0;
  const fuelType = normalized(listing.fuel_type);
  const bodyType = normalized(listing.body_type);
  const condition = normalized(listing.condition);

  if (listing.price_sar !== undefined && listing.price_sar !== null && listing.price_sar <= BUDGET_PRICE) score += 3;
  if (listing.mileage_km !== undefined && listing.mileage_km !== null && listing.mileage_km <= DAILY_MILEAGE_KM) score += 2;
  if (fuelType === "hybrid" || fuelType === "petrol" || fuelType === "gasoline") score += 1;
  if (bodyType === "sedan" || bodyType === "hatchback" || bodyType === "wagon") score += 2;
  if (condition === "used") score += 1;

  return Math.min(score, 10);
}

export function nicheScore(listing: NicheListingSignal, nicheId?: string | null): number {
  const niche = getNiche(nicheId);
  if (niche.id === "budget_daily_driver") return budgetDailyScore(listing);
  return coldWeatherScore(listing);
}

export function nicheScoreLabel(listing: NicheListingSignal, nicheId?: string | null): string {
  const score = nicheScore(listing, nicheId);
  if (score >= 7) return "Strong niche fit";
  if (score >= 4) return "Good niche fit";
  return "Basic match";
}

export function nicheBadges(listing: NicheListingSignal, locale: Locale, nicheId?: string | null): string[] {
  const niche = getNiche(nicheId);
  const badges: string[] = [];
  const drivetrain = normalized(listing.drivetrain);
  const bodyType = normalized(listing.body_type);

  if (niche.id === "budget_daily_driver") {
    if (listing.price_sar !== undefined && listing.price_sar !== null && listing.price_sar <= BUDGET_PRICE) {
      badges.push(`Under ${formatListingPrice(BUDGET_PRICE, locale)}`);
    }
    if (listing.mileage_km !== undefined && listing.mileage_km !== null && listing.mileage_km <= DAILY_MILEAGE_KM) {
      badges.push(`Under ${formatDistance(DAILY_MILEAGE_KM, locale)}`);
    }
    if (bodyType === "sedan" || bodyType === "hatchback" || bodyType === "wagon") {
      badges.push(`${listing.body_type} daily body`);
    }
  } else {
    if (drivetrain === "awd" || drivetrain === "4wd") badges.push(`${listing.drivetrain} winter traction`);
    if (listing.price_sar !== undefined && listing.price_sar !== null && listing.price_sar <= AFFORDABLE_PRICE) {
      badges.push(`Under ${formatListingPrice(AFFORDABLE_PRICE, locale)}`);
    }
    if (listing.mileage_km !== undefined && listing.mileage_km !== null && listing.mileage_km <= LOW_MILEAGE_KM) {
      badges.push(`Under ${formatDistance(LOW_MILEAGE_KM, locale)}`);
    }
  }

  if (badges.length === 0) {
    badges.push(nicheScoreLabel(listing, niche.id));
  }

  return badges.slice(0, 3);
}
