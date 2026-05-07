"use client";

import Link from "next/link";

import { NICHES, getNiche } from "@/shared/niches";
import { saveNichePreference } from "@/shared/niche-preference";

type HomeFilterParams = {
  niche?: string;
  city?: string;
  q?: string;
  price_max?: string;
  mileage_max?: string;
  fuel_type?: string;
  drivetrain?: string;
  body_type?: string;
  sort?: string;
  lat?: string;
  lon?: string;
  radius_mi?: string;
  radius_km?: string;
};

type HomeFilterControlsProps = {
  params: HomeFilterParams;
};

const QUERY_KEYS = ["niche", "q", "city", "price_max", "mileage_max", "fuel_type", "drivetrain", "body_type", "sort", "lat", "lon", "radius_mi", "radius_km"] as const;

function buildHomepageHref(params: HomeFilterParams): string {
  const next = new URLSearchParams();

  for (const key of QUERY_KEYS) {
    const value = params[key]?.trim();
    if (value) {
      next.set(key, value);
    }
  }

  const qs = next.toString();
  return qs ? `/?${qs}` : "/";
}

function nicheHref(params: HomeFilterParams, nicheId: string): string {
  const next = { ...params, niche: nicheId };

  return buildHomepageHref(next);
}

export default function HomeFilterControls({ params }: HomeFilterControlsProps) {
  const selectedNiche = getNiche(params.niche);

  return (
    <div className="home-filter-controls">
      <nav className="home-quick-filters" aria-label="One-tap filters">
        <p className="home-quick-filters-label">Choose niche</p>
        <div className="home-quick-filter-list">
          {NICHES.map((niche) => (
            <Link
              key={niche.id}
              scroll={false}
              href={nicheHref(params, niche.id)}
              onClick={() => saveNichePreference(niche.id)}
              className={selectedNiche.id === niche.id ? "home-niche-filter-active" : ""}
              aria-current={selectedNiche.id === niche.id ? "true" : undefined}
            >
              {niche.shortName}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
