"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { formatNumber } from "@/lib/locale";

const DISTANCE_OPTIONS_MILES = [5, 10, 25, 50, 100, 200, 500];

function formatMiles(value: number, locale: ReturnType<typeof useLocale>) {
  return `${formatNumber(value, locale)} mi`;
}

export default function NearbySearch({ initialRadiusMi }: { initialRadiusMi: number }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("");
  const [radiusMi, setRadiusMi] = useState<number>(initialRadiusMi);
  const text = {
    distance: "Distance",
    useMyLocation: "Near me",
    clearLocation: "Clear location",
    geolocationUnsupported: "Geolocation not supported in this browser.",
    requestingLocation: "Requesting location...",
    unableToRetrieveLocation: "Unable to retrieve location.",
    showingWithin: (distance: number) => `Showing cars within ${formatMiles(distance, locale)}.`,
    filteringWithin: (distance: number) => `Cars within ${formatMiles(distance, locale)}.`,
  };

  const isActive = useMemo(() => {
    return Boolean(searchParams.get("lat") && searchParams.get("lon"));
  }, [searchParams]);

  useEffect(() => {
    const nextRadius = Number(searchParams.get("radius_mi"));
    if (Number.isFinite(nextRadius) && nextRadius >= 1 && nextRadius <= 500) {
      setRadiusMi(nextRadius);
      return;
    }
    const oldRadiusKm = Number(searchParams.get("radius_km"));
    if (Number.isFinite(oldRadiusKm) && oldRadiusKm >= 1 && oldRadiusKm <= 805) {
      setRadiusMi(Math.max(1, Math.round(oldRadiusKm / 1.60934)));
      return;
    }
    setRadiusMi(initialRadiusMi);
  }, [initialRadiusMi, searchParams]);

  function updateParams(next: URLSearchParams) {
    const nextUrl = next.toString() ? `${pathname}?${next.toString()}` : pathname;
    router.replace(nextUrl);
  }

  function handleRadiusChange(e: ChangeEvent<HTMLSelectElement>) {
    const nextRadius = Number(e.target.value);
    setRadiusMi(nextRadius);

    if (!isActive) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.set("radius_mi", String(nextRadius));
    next.delete("radius_km");
    setStatus(text.showingWithin(nextRadius));
    updateParams(next);
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setStatus(text.geolocationUnsupported);
      return;
    }
    setStatus(text.requestingLocation);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("lat", pos.coords.latitude.toFixed(6));
        next.set("lon", pos.coords.longitude.toFixed(6));
        next.set("radius_mi", String(radiusMi));
        next.delete("radius_km");
        setStatus(text.showingWithin(radiusMi));
        updateParams(next);
      },
      (err) => {
        setStatus(err.message || text.unableToRetrieveLocation);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  function handleClear() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("lat");
    next.delete("lon");
    next.delete("radius_mi");
    next.delete("radius_km");
    setStatus("");
    updateParams(next);
  }

  return (
    <div className="panel-compact">
      <div className="inline-actions">
        <label className="label" htmlFor="distance-mi">{text.distance}</label>
        <select
          id="distance-mi"
          className="select"
          value={radiusMi}
          onChange={handleRadiusChange}
        >
          {DISTANCE_OPTIONS_MILES.map((distance) => (
            <option key={distance} value={distance}>
              {formatMiles(distance, locale)}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={handleUseLocation}>
          {text.useMyLocation} ({formatMiles(radiusMi, locale)})
        </button>
        {isActive ? (
          <button type="button" className="btn" onClick={handleClear}>
            {text.clearLocation}
          </button>
        ) : null}
      </div>
      {status ? <div className="helper-text">{status}</div> : null}
      {!status && isActive ? (
        <div className="helper-text">{text.filteringWithin(radiusMi)}</div>
      ) : null}
    </div>
  );
}
