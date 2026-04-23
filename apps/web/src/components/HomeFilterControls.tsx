"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { NICHES, getNiche } from "@/shared/niches";

type HomeFilterParams = {
  niche?: string;
  city?: string;
  q?: string;
  price_max?: string;
  mileage_max?: string;
  fuel_type?: string;
  drivetrain?: string;
  body_type?: string;
  lat?: string;
  lon?: string;
  radius_km?: string;
};

type HomeFilterControlsProps = {
  params: HomeFilterParams;
};

const NEARBY_RADIUS_KM = "40";
const QUERY_KEYS = ["niche", "q", "city", "price_max", "mileage_max", "fuel_type", "drivetrain", "body_type", "lat", "lon", "radius_km"] as const;
const NICHE_FILTER_KEYS = ["price_max", "mileage_max", "fuel_type", "drivetrain", "body_type"] as const;

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

function filterHref(params: HomeFilterParams, key: keyof HomeFilterParams, value: string): string {
  const next = { ...params };

  if (next[key] === value) {
    delete next[key];
  } else {
    next[key] = value;
  }

  return buildHomepageHref(next);
}

function nicheHref(params: HomeFilterParams, nicheId: string): string {
  const next = { ...params, niche: nicheId };

  for (const key of NICHE_FILTER_KEYS) {
    delete next[key];
  }

  return buildHomepageHref(next);
}

function isFilterActive(params: HomeFilterParams, key: keyof HomeFilterParams, value: string): boolean {
  return params[key] === value;
}

function quickFilterClass(params: HomeFilterParams, key: keyof HomeFilterParams, value: string): string {
  return isFilterActive(params, key, value) ? "home-quick-filter-active" : "";
}

export default function HomeFilterControls({ params }: HomeFilterControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nearbyStatus, setNearbyStatus] = useState("");
  const selectedNiche = getNiche(params.niche);
  const isNearbyActive = Boolean(params.lat && params.lon && params.radius_km === NEARBY_RADIUS_KM);

  function handleNearbyClick() {
    if (isNearbyActive) {
      const next = { ...params };
      delete next.lat;
      delete next.lon;
      delete next.radius_km;
      setNearbyStatus("");
      startTransition(() => {
        router.replace(buildHomepageHref(next), { scroll: false });
      });
      return;
    }

    if (!navigator.geolocation) {
      setNearbyStatus("Location is not available in this browser.");
      return;
    }

    setNearbyStatus("Finding cars near you...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          ...params,
          lat: position.coords.latitude.toFixed(6),
          lon: position.coords.longitude.toFixed(6),
          radius_km: NEARBY_RADIUS_KM,
        };
        setNearbyStatus("Showing cars within 25 miles.");
        startTransition(() => {
          router.replace(buildHomepageHref(next), { scroll: false });
        });
      },
      (error) => {
        setNearbyStatus(error.message || "Could not get your location.");
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  return (
    <div className={isPending ? "home-filter-controls is-updating" : "home-filter-controls"}>
      <nav className="home-quick-filters" aria-label="One-tap filters">
        <p className="home-quick-filters-label">Choose niche</p>
        <div className="home-quick-filter-list">
          {NICHES.map((niche) => (
            <Link
              key={niche.id}
              scroll={false}
              href={nicheHref(params, niche.id)}
              className={selectedNiche.id === niche.id ? "home-niche-filter-active" : ""}
              aria-current={selectedNiche.id === niche.id ? "true" : undefined}
            >
              {niche.shortName}
            </Link>
          ))}
        </div>
        <p className="home-quick-filters-label">Quick filters</p>
        <div className="home-quick-filter-list">
          <button
            type="button"
            className={isNearbyActive ? "home-quick-filter-active" : ""}
            onClick={handleNearbyClick}
            disabled={isPending}
            aria-pressed={isNearbyActive}
          >
            Nearby (25 mi)
          </button>
          {selectedNiche.quickFilters.map((filter) => (
            <Link
              key={`${filter.key}:${filter.value}`}
              scroll={false}
              href={filterHref(params, filter.key, filter.value)}
              className={quickFilterClass(params, filter.key, filter.value)}
              aria-current={isFilterActive(params, filter.key, filter.value) ? "true" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </nav>
      {nearbyStatus ? <p className="helper-text">{nearbyStatus}</p> : null}
    </div>
  );
}
