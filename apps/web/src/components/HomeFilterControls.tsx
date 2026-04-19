"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type HomeFilterParams = {
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
const QUERY_KEYS = ["q", "city", "price_max", "mileage_max", "fuel_type", "drivetrain", "body_type", "lat", "lon", "radius_km"] as const;

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
      <nav className="home-quick-filters" aria-label="Quick filters">
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
          <Link scroll={false} href={filterHref(params, "price_max", "30000")} className={quickFilterClass(params, "price_max", "30000")} aria-current={isFilterActive(params, "price_max", "30000") ? "true" : undefined}>Under $30k</Link>
          <Link scroll={false} href={filterHref(params, "drivetrain", "AWD")} className={quickFilterClass(params, "drivetrain", "AWD")} aria-current={isFilterActive(params, "drivetrain", "AWD") ? "true" : undefined}>AWD</Link>
          <Link scroll={false} href={filterHref(params, "drivetrain", "4WD")} className={quickFilterClass(params, "drivetrain", "4WD")} aria-current={isFilterActive(params, "drivetrain", "4WD") ? "true" : undefined}>4WD</Link>
          <Link scroll={false} href={filterHref(params, "fuel_type", "Hybrid")} className={quickFilterClass(params, "fuel_type", "Hybrid")} aria-current={isFilterActive(params, "fuel_type", "Hybrid") ? "true" : undefined}>Hybrids</Link>
          <Link scroll={false} href={filterHref(params, "fuel_type", "Electric")} className={quickFilterClass(params, "fuel_type", "Electric")} aria-current={isFilterActive(params, "fuel_type", "Electric") ? "true" : undefined}>EVs</Link>
          <Link scroll={false} href={filterHref(params, "mileage_max", "100000")} className={quickFilterClass(params, "mileage_max", "100000")} aria-current={isFilterActive(params, "mileage_max", "100000") ? "true" : undefined}>Under 100k mi</Link>
          <Link scroll={false} href={filterHref(params, "body_type", "SUV")} className={quickFilterClass(params, "body_type", "SUV")} aria-current={isFilterActive(params, "body_type", "SUV") ? "true" : undefined}>SUVs</Link>
          <Link scroll={false} href={filterHref(params, "city", "Buffalo")} className={quickFilterClass(params, "city", "Buffalo")} aria-current={isFilterActive(params, "city", "Buffalo") ? "true" : undefined}>Buffalo</Link>
        </div>
      </nav>
      {nearbyStatus ? <p className="helper-text">{nearbyStatus}</p> : null}
    </div>
  );
}
