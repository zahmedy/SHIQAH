"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function NearbySearch({ radiusKm }: { radiusKm: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("");

  const isActive = useMemo(() => {
    return Boolean(searchParams.get("lat") && searchParams.get("lon"));
  }, [searchParams]);

  function updateParams(next: URLSearchParams) {
    const nextUrl = next.toString() ? `${pathname}?${next.toString()}` : pathname;
    router.replace(nextUrl);
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setStatus("Geolocation not supported in this browser.");
      return;
    }
    setStatus("Requesting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("lat", pos.coords.latitude.toFixed(6));
        next.set("lon", pos.coords.longitude.toFixed(6));
        next.set("radius_km", String(radiusKm));
        setStatus(`Using your location within ${radiusKm} km.`);
        updateParams(next);
      },
      (err) => {
        setStatus(err.message || "Unable to retrieve location.");
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
        <button type="button" className="btn btn-secondary" onClick={handleUseLocation}>
          Use my location ({radiusKm} km)
        </button>
        {isActive ? (
          <button type="button" className="btn" onClick={handleClear}>
            Clear location
          </button>
        ) : null}
      </div>
      {status ? <div className="helper-text">{status}</div> : null}
      {!status && isActive ? (
        <div className="helper-text">Filtering listings within {radiusKm} km.</div>
      ) : null}
    </div>
  );
}
