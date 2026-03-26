"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { formatDistance } from "@/lib/locale";

const DISTANCE_OPTIONS = [5, 10, 25, 50, 100, 200, 500];

export default function NearbySearch({ initialRadiusKm }: { initialRadiusKm: number }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(initialRadiusKm);
  const text = locale === "ar"
    ? {
        distance: "المسافة",
        useMyLocation: "حدّد موقعي",
        clearLocation: "امسح الموقع",
        geolocationUnsupported: "المتصفح ما يدعم تحديد الموقع.",
        requestingLocation: "جارٍ تحديد موقعك...",
        unableToRetrieveLocation: "ما قدرنا نحدد موقعك.",
        showingWithin: (distance: number) => `نطلع لك الإعلانات القريبة ضمن ${formatDistance(distance, locale)}.`,
        filteringWithin: (distance: number) => `نعرض لك الإعلانات القريبة ضمن ${formatDistance(distance, locale)}.`,
      }
    : {
        distance: "Distance",
        useMyLocation: "Use my location",
        clearLocation: "Clear location",
        geolocationUnsupported: "Geolocation not supported in this browser.",
        requestingLocation: "Requesting location...",
        unableToRetrieveLocation: "Unable to retrieve location.",
        showingWithin: (distance: number) => `Showing listings within ${formatDistance(distance, locale)}.`,
        filteringWithin: (distance: number) => `Filtering listings within ${formatDistance(distance, locale)}.`,
      };

  const isActive = useMemo(() => {
    return Boolean(searchParams.get("lat") && searchParams.get("lon"));
  }, [searchParams]);

  useEffect(() => {
    const nextRadius = Number(searchParams.get("radius_km"));
    if (Number.isFinite(nextRadius) && nextRadius >= 1 && nextRadius <= 500) {
      setRadiusKm(nextRadius);
      return;
    }
    setRadiusKm(initialRadiusKm);
  }, [initialRadiusKm, searchParams]);

  function updateParams(next: URLSearchParams) {
    const nextUrl = next.toString() ? `${pathname}?${next.toString()}` : pathname;
    router.replace(nextUrl);
  }

  function handleRadiusChange(e: ChangeEvent<HTMLSelectElement>) {
    const nextRadius = Number(e.target.value);
    setRadiusKm(nextRadius);

    if (!isActive) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.set("radius_km", String(nextRadius));
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
        next.set("radius_km", String(radiusKm));
        setStatus(text.showingWithin(radiusKm));
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
    next.delete("radius_km");
    setStatus("");
    updateParams(next);
  }

  return (
    <div className="panel-compact">
      <div className="inline-actions">
        <label className="label" htmlFor="distance-km">{text.distance}</label>
        <select
          id="distance-km"
          className="select"
          value={radiusKm}
          onChange={handleRadiusChange}
        >
          {DISTANCE_OPTIONS.map((distance) => (
            <option key={distance} value={distance}>
              {formatDistance(distance, locale)}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={handleUseLocation}>
          {text.useMyLocation} ({formatDistance(radiusKm, locale)})
        </button>
        {isActive ? (
          <button type="button" className="btn" onClick={handleClear}>
            {text.clearLocation}
          </button>
        ) : null}
      </div>
      {status ? <div className="helper-text">{status}</div> : null}
      {!status && isActive ? (
        <div className="helper-text">{text.filteringWithin(radiusKm)}</div>
      ) : null}
    </div>
  );
}
