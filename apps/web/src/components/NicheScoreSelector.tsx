"use client";

import { useState } from "react";

import { type Locale } from "@/lib/locale";
import {
  NICHES,
  getNiche,
  nicheBadges,
  nicheScoreDetails,
  nicheScoreLabel,
  type NicheListingSignal,
} from "@/shared/niches";

type NicheScoreSelectorProps = {
  listing: NicheListingSignal;
  locale: Locale;
  initialNicheId?: string | null;
};

export default function NicheScoreSelector({ listing, locale, initialNicheId }: NicheScoreSelectorProps) {
  const [selectedNicheId, setSelectedNicheId] = useState(() => getNiche(initialNicheId).id);
  const selectedNiche = getNiche(selectedNicheId);
  const nicheScores = NICHES.map((niche) => ({
    ...niche,
    details: nicheScoreDetails(listing, niche.id),
    fitLabel: nicheScoreLabel(listing, niche.id),
  }));
  const selectedScore = nicheScores.find((niche) => niche.id === selectedNiche.id) ?? nicheScores[0];
  const badges = nicheBadges(listing, locale, selectedNiche.id);

  return (
    <div className="panel panel-soft winter-detail-card niche-score-card">
      <div className="niche-score-head">
        <div>
          <p className="spec-key">Niche</p>
          <h2 className="subheading">Buyer fit</h2>
        </div>
        <strong className="niche-score-meter">{selectedScore.details.score}/100</strong>
      </div>

      <div className="niche-score-options" aria-label="Choose niche score">
        {nicheScores.map((niche) => (
          <button
            key={niche.id}
            type="button"
            className={`niche-score-option${selectedNiche.id === niche.id ? " niche-score-option-active" : ""}`}
            aria-pressed={selectedNiche.id === niche.id}
            onClick={() => setSelectedNicheId(niche.id)}
          >
            <span>{niche.shortName}</span>
            <strong>{niche.details.score}/100</strong>
            <small>{niche.fitLabel}</small>
          </button>
        ))}
      </div>

      <div>
        <p className="spec-key">{selectedNiche.scoreLabel}</p>
        <p className="body-copy niche-score-summary">
          {selectedScore.fitLabel}. Confidence: {selectedScore.details.confidence}.
        </p>
      </div>
      <div className="winter-chip-row" aria-label="Niche signals">
        {badges.map((badge) => (
          <span className="winter-chip" key={badge}>{badge}</span>
        ))}
      </div>
    </div>
  );
}
