"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";

import MakeModelField from "@/components/MakeModelField";
import NearbySearch from "@/components/NearbySearch";

type HomeFilterParams = {
  city?: string;
  make?: string;
  model?: string;
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
  isFiltered: boolean;
};

const QUERY_KEYS = ["q", "city", "make", "model", "price_max", "mileage_max", "fuel_type", "drivetrain", "body_type", "lat", "lon", "radius_km"] as const;
const FUEL_TYPE_OPTIONS = [
  ["Hybrid", "Hybrid"],
  ["Electric", "Electric"],
  ["Petrol", "Gasoline"],
] as const;
const DRIVETRAIN_OPTIONS = ["AWD", "4WD", "FWD", "RWD"] as const;
const BODY_TYPE_OPTIONS = ["SUV", "Hatchback", "Sedan", "Pickup", "Van"] as const;

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

export default function HomeFilterControls({ params, isFiltered }: HomeFilterControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formKey = QUERY_KEYS.map((key) => params[key] ?? "").join("|");
  const radiusKm = Number(params.radius_km);
  const initialRadiusKm = Number.isFinite(radiusKm) && radiusKm >= 1 && radiusKm <= 500 ? radiusKm : 50;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const next: HomeFilterParams = {};

    for (const key of QUERY_KEYS) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) {
        next[key] = value;
      }
    }

    startTransition(() => {
      router.replace(buildHomepageHref(next), { scroll: false });
    });
  }

  return (
    <div className={isPending ? "home-filter-controls is-updating" : "home-filter-controls"}>
      <form key={formKey} className="home-filter-form" onSubmit={handleSubmit}>
        {params.lat ? <input type="hidden" name="lat" value={params.lat} /> : null}
        {params.lon ? <input type="hidden" name="lon" value={params.lon} /> : null}
        {params.radius_km ? <input type="hidden" name="radius_km" value={params.radius_km} /> : null}
        <input name="q" defaultValue={params.q ?? ""} className="input" placeholder="Keyword" aria-label="Keyword" />
        <input name="city" defaultValue={params.city ?? ""} className="input" placeholder="City" aria-label="City" />
        <MakeModelField defaultMake={params.make ?? ""} defaultModel={params.model ?? ""} />
        <input name="price_max" defaultValue={params.price_max ?? ""} className="input" inputMode="numeric" placeholder="Max $" aria-label="Max price" />
        <select name="fuel_type" defaultValue={params.fuel_type ?? ""} className="select" aria-label="Fuel type">
          <option value="">Any fuel</option>
          {FUEL_TYPE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select name="drivetrain" defaultValue={params.drivetrain ?? ""} className="select" aria-label="Drivetrain">
          <option value="">Any drive</option>
          {DRIVETRAIN_OPTIONS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select name="body_type" defaultValue={params.body_type ?? ""} className="select" aria-label="Body type">
          <option value="">Any body</option>
          {BODY_TYPE_OPTIONS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Filtering" : "Filter"}</button>
        {isFiltered ? <Link href="/" scroll={false} className="btn btn-secondary">Clear</Link> : null}
      </form>

      <NearbySearch initialRadiusKm={initialRadiusKm} />

      <nav className="home-quick-filters" aria-label="Quick filters">
        <p className="home-quick-filters-label">Quick filters</p>
        <div className="home-quick-filter-list">
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
    </div>
  );
}
