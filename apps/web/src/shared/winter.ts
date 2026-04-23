import type { Locale } from "@/lib/locale";
import {
  DEFAULT_NICHE_ID,
  nicheBadges,
  nicheScore,
  nicheScoreLabel,
  type NicheListingSignal,
} from "@/shared/niches";

export type WinterListingSignal = NicheListingSignal;

export function winterScore(listing: WinterListingSignal): number {
  return nicheScore(listing, DEFAULT_NICHE_ID);
}

export function winterScoreLabel(listing: WinterListingSignal): string {
  return nicheScoreLabel(listing, DEFAULT_NICHE_ID);
}

export function winterBadges(listing: WinterListingSignal, locale: Locale): string[] {
  return nicheBadges(listing, locale, DEFAULT_NICHE_ID);
}
