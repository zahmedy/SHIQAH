import Link from "next/link";

import { apiGet } from "@/lib/api";
import LeadForm from "./LeadForm";

type Photo = {
  id: number;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
};

type Listing = {
  id: number;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price_sar: number;
  mileage_km?: number;
  title_ar: string;
  description_ar: string;
  transmission?: string;
  fuel_type?: string;
  body_type?: string;
  condition?: string;
  color?: string;
  photos: Photo[];
};

type PublicCarResponse = {
  listing: Listing;
  seller: {
    id: number | null;
    phone_e164: string | null;
  };
  contact: {
    whatsapp_url: string | null;
    call_phone_e164: string | null;
  };
};

const priceFormatter = new Intl.NumberFormat("en-US");

function specValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: PublicCarResponse | null = null;
  let fetchError = "";

  try {
    data = await apiGet<PublicCarResponse>(`/v1/public/cars/${id}`);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load listing.";
  }

  if (!data) {
    return (
      <main className="page shell">
        <div className="notice error">{fetchError || "Listing not found."}</div>
        <div style={{ marginTop: "1rem" }}>
          <Link href="/search" className="btn btn-secondary">Back to search</Link>
        </div>
      </main>
    );
  }

  const car = data.listing;

  return (
    <main className="page shell two-col">
      <section className="panel">
        <h1 style={{ margin: 0, fontFamily: "Avenir Next, Tahoma, Trebuchet MS, sans-serif" }}>
          {car.title_ar}
        </h1>
        <p className="car-price" style={{ marginTop: "0.5rem" }}>
          {priceFormatter.format(car.price_sar)} SAR
        </p>

        {car.photos?.length ? (
          <div className="photo-grid">
            {car.photos.map((photo) => (
              <img key={photo.id} src={photo.public_url} alt={car.title_ar} loading="lazy" />
            ))}
          </div>
        ) : (
          <div className="notice" style={{ marginTop: "0.8rem" }}>No photos yet.</div>
        )}

        <div className="specs">
          <article className="spec">
            <p className="spec-key">Make</p>
            <p className="spec-val">{specValue(car.make)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Model</p>
            <p className="spec-val">{specValue(car.model)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Year</p>
            <p className="spec-val">{specValue(car.year)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Mileage</p>
            <p className="spec-val">{car.mileage_km ? `${car.mileage_km.toLocaleString()} km` : "—"}</p>
          </article>
          <article className="spec">
            <p className="spec-key">City</p>
            <p className="spec-val">{specValue(car.city)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">District</p>
            <p className="spec-val">{specValue(car.district)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Transmission</p>
            <p className="spec-val">{specValue(car.transmission)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Fuel</p>
            <p className="spec-val">{specValue(car.fuel_type)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Body Type</p>
            <p className="spec-val">{specValue(car.body_type)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Condition</p>
            <p className="spec-val">{specValue(car.condition)}</p>
          </article>
          <article className="spec">
            <p className="spec-key">Color</p>
            <p className="spec-val">{specValue(car.color)}</p>
          </article>
        </div>

        <div className="panel" style={{ marginTop: "0.8rem", padding: "0.9rem" }}>
          <h2 style={{ marginTop: 0 }}>Description</h2>
          <p style={{ marginBottom: 0, fontFamily: "Avenir Next, Tahoma, Trebuchet MS, sans-serif" }}>
            {car.description_ar}
          </p>
        </div>
      </section>

      <aside className="panel">
        <h2 style={{ marginTop: 0 }}>Contact Seller</h2>
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {data.contact.call_phone_e164 && (
            <a href={`tel:${data.contact.call_phone_e164}`} className="btn btn-secondary">
              Call Seller
            </a>
          )}

          {data.contact.whatsapp_url && (
            <a href={data.contact.whatsapp_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
              Open WhatsApp
            </a>
          )}
        </div>

        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1rem 0" }} />

        <h3 style={{ marginTop: 0 }}>Send a Lead</h3>
        <LeadForm carId={car.id} />
      </aside>
    </main>
  );
}
