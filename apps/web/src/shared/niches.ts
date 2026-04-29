export type NicheListingSignal = {
  city?: string | null;
  make?: string | null;
  model?: string | null;
  mileage?: number | null;
  fuel_type?: string | null;
  drivetrain?: string | null;
  body_type?: string | null;
  condition?: string | null;
  description_ar?: string | null;
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
    signals: ["Lower miles", "Efficient fuel", "Easy body styles"],
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
