export type NicheListingSignal = {
  city?: string | null;
  make?: string | null;
  model?: string | null;
  mileage?: number | null;
  fuel_type?: string | null;
  drivetrain?: string | null;
  body_type?: string | null;
  condition?: string | null;
  description?: string | null;
  niche_scores?: Record<string, NicheScoreResult>;
};

export type NicheScoreConfidence = "low" | "medium" | "high";

export type NicheScoreResult = {
  score: number;
  confidence: NicheScoreConfidence;
  label: "Strong niche fit" | "Good niche fit" | "Basic niche fit" | "Weak niche fit";
  reasons: string[];
  warnings: string[];
  missing_signals: string[];
};

export type NicheFilterQuery = Partial<Record<"price_max" | "mileage_max" | "fuel_type" | "drivetrain" | "body_type" | "sort", string>>;

export type NicheQuickFilter = {
  label: string;
  query: NicheFilterQuery;
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
    query: NicheFilterQuery;
  }>;
};

const AFFORDABLE_PRICE = 30000;
const BUDGET_PRICE = 20000;
const LOW_MILEAGE_MILES = 100000;
const DAILY_MILEAGE_MILES = 120000;
const VALUE_PRICE = 25000;

export const DEFAULT_NICHE_ID = "cold_weather_commuter";

export const NICHES: NicheDefinition[] = [
  {
    id: DEFAULT_NICHE_ID,
    name: "Cold-weather commuter",
    shortName: "Cold weather",
    intro: "Affordable cars for snow, cold starts, short commutes, and rough winter weeks.",
    scoreLabel: "Cold-weather fit",
    signals: ["AWD / 4WD", "Winter equipment", "Lower miles"],
    quickFilters: [
      { label: "Winter value", query: { price_max: String(AFFORDABLE_PRICE), mileage_max: String(LOW_MILEAGE_MILES), sort: "price_asc" } },
      { label: "AWD under $30k", query: { price_max: String(AFFORDABLE_PRICE), drivetrain: "AWD", sort: "price_asc" } },
      { label: "4WD SUVs", query: { drivetrain: "4WD", body_type: "SUV" } },
      { label: "Low-mile AWD", query: { mileage_max: String(LOW_MILEAGE_MILES), drivetrain: "AWD", sort: "mileage_asc" } },
      { label: "SUVs under $30k", query: { price_max: String(AFFORDABLE_PRICE), body_type: "SUV", sort: "price_asc" } },
      { label: "Wagons under 100k", query: { mileage_max: String(LOW_MILEAGE_MILES), body_type: "Wagon", sort: "mileage_asc" } },
    ],
    searchLinks: [
      { label: "Winter value", query: { price_max: String(AFFORDABLE_PRICE), mileage_max: String(LOW_MILEAGE_MILES), sort: "price_asc" } },
      { label: "AWD under $30k", query: { price_max: String(AFFORDABLE_PRICE), drivetrain: "AWD", sort: "price_asc" } },
      { label: "Low-mile AWD", query: { mileage_max: String(LOW_MILEAGE_MILES), drivetrain: "AWD", sort: "mileage_asc" } },
      { label: "4WD SUVs", query: { drivetrain: "4WD", body_type: "SUV" } },
      { label: "SUVs under $30k", query: { price_max: String(AFFORDABLE_PRICE), body_type: "SUV", sort: "price_asc" } },
    ],
  },
  {
    id: "budget_daily_driver",
    name: "Budget daily driver",
    shortName: "Budget daily",
    intro: "Simple, affordable cars for daily errands, work commutes, and first-time buyers.",
    scoreLabel: "Daily-driver fit",
    signals: ["Lower miles", "Efficient fuel", "Easy body styles"],
    quickFilters: [
      { label: "Best budget fit", query: { price_max: String(AFFORDABLE_PRICE), mileage_max: String(DAILY_MILEAGE_MILES), sort: "price_asc" } },
      { label: "Under $20k", query: { price_max: String(BUDGET_PRICE), sort: "price_asc" } },
      { label: "Under 120k mi", query: { mileage_max: String(DAILY_MILEAGE_MILES), sort: "mileage_asc" } },
      { label: "Sedans under $25k", query: { price_max: String(VALUE_PRICE), body_type: "Sedan", sort: "price_asc" } },
      { label: "Efficient daily", query: { fuel_type: "Hybrid", mileage_max: String(DAILY_MILEAGE_MILES), sort: "mileage_asc" } },
      { label: "EV value", query: { fuel_type: "Electric", price_max: String(AFFORDABLE_PRICE), sort: "price_asc" } },
    ],
    searchLinks: [
      { label: "Best budget fit", query: { price_max: String(AFFORDABLE_PRICE), mileage_max: String(DAILY_MILEAGE_MILES), sort: "price_asc" } },
      { label: "Under $20k", query: { price_max: String(BUDGET_PRICE), sort: "price_asc" } },
      { label: "Under 120k mi", query: { mileage_max: String(DAILY_MILEAGE_MILES), sort: "mileage_asc" } },
      { label: "Sedans under $25k", query: { price_max: String(VALUE_PRICE), body_type: "Sedan", sort: "price_asc" } },
      { label: "Hybrids under $30k", query: { fuel_type: "Hybrid", price_max: String(AFFORDABLE_PRICE), sort: "price_asc" } },
    ],
  },
];

export function getNiche(id?: string | null): NicheDefinition {
  return NICHES.find((niche) => niche.id === id) ?? NICHES[0];
}

export function nicheHref(pathname: string, niche: NicheDefinition, query: NicheFilterQuery = {}): string {
  const qs = new URLSearchParams({ niche: niche.id, ...query });
  return `${pathname}?${qs.toString()}`;
}

function emptyNicheScore(): NicheScoreResult {
  return {
    score: 0,
    confidence: "low",
    label: "Weak niche fit",
    reasons: [],
    warnings: [],
    missing_signals: ["Niche score unavailable"],
  };
}

export function nicheScoreDetails(listing: NicheListingSignal, nicheId?: string | null): NicheScoreResult {
  const niche = getNiche(nicheId);
  return listing.niche_scores?.[niche.id] ?? emptyNicheScore();
}

export function nicheScore(listing: NicheListingSignal, nicheId?: string | null): number {
  return nicheScoreDetails(listing, nicheId).score;
}

export function nicheScoreLabel(listing: NicheListingSignal, nicheId?: string | null): string {
  return nicheScoreDetails(listing, nicheId).label;
}

function meaningfulBadge(value: string): boolean {
  const tag = value.trim();
  if (!tag || tag.length > 42) return false;

  const genericPhrases = [
    "fuel type is common",
    "fits routine commuting",
    "condition aligns",
    "can work",
    "still workable",
    "seller notes mention",
    "limited",
    "has limited",
  ];
  const normalized = tag.toLowerCase();
  return !genericPhrases.some((phrase) => normalized.includes(phrase));
}

export function nicheBadges(listing: NicheListingSignal, _locale: unknown, nicheId?: string | null): string[] {
  const details = nicheScoreDetails(listing, nicheId);
  const reasons = details.reasons.filter(meaningfulBadge);
  if (reasons.length) {
    return reasons.slice(0, 3);
  }

  const warnings = details.warnings.filter(meaningfulBadge);
  if (warnings.length) {
    return warnings.slice(0, 3);
  }

  return [details.label];
}
