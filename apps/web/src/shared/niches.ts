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
  label: string;
  reasons: string[];
  warnings: string[];
  missing_signals: string[];
};

export type NicheDefinition = {
  id: string;
  name: string;
  shortName: string;
  intro: string;
  scoreLabel: string;
  signals: string[];
};

export const DEFAULT_NICHE_ID = "cold_weather_commuter";

export const NICHES: NicheDefinition[] = [
  {
    id: DEFAULT_NICHE_ID,
    name: "Winter Value",
    shortName: "Winter Value",
    intro: "Affordable cars for snow, cold starts, short commutes, and rough winter weeks.",
    scoreLabel: "Cold-weather fit",
    signals: ["AWD / 4WD", "Winter equipment", "Lower miles"],
  },
  {
    id: "budget_daily_driver",
    name: "Budget Daily",
    shortName: "Budget Daily",
    intro: "Simple, affordable cars for daily errands, work commutes, and first-time buyers.",
    scoreLabel: "Daily-driver fit",
    signals: ["Lower miles", "Efficient fuel", "Easy body styles"],
  },
];

export function getNiche(id?: string | null): NicheDefinition {
  return NICHES.find((niche) => niche.id === id) ?? NICHES[0];
}

function emptyNicheScore(): NicheScoreResult {
  return {
    score: 0,
    confidence: "low",
    label: "Weak",
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

function nicheFitName(niche: NicheDefinition): string {
  if (niche.id === DEFAULT_NICHE_ID) return "winter";
  if (niche.id === "budget_daily_driver") return "budget";
  return niche.shortName.split(/\s+/)[0]?.toLowerCase() || "niche";
}

function fitStrength(label: string): "Strong" | "Good" | "Basic" | "Weak" {
  const normalized = label.trim().toLowerCase();
  if (normalized.startsWith("strong")) return "Strong";
  if (normalized.startsWith("good")) return "Good";
  if (normalized.startsWith("basic")) return "Basic";
  return "Weak";
}

export function nicheScoreLabel(listing: NicheListingSignal, nicheId?: string | null): string {
  const niche = getNiche(nicheId);
  const details = nicheScoreDetails(listing, niche.id);
  return `${fitStrength(details.label)} ${nicheFitName(niche)} fit`;
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

  return [nicheScoreLabel(listing, nicheId)];
}
