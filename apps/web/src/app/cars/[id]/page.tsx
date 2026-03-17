import Link from "next/link";

import { apiGet } from "@/lib/api";
import ChatPanel from "./ChatPanel";
import OwnerActions from "./OwnerActions";

type Photo = {
  id: number;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
};

type Listing = {
  id: number;
  owner_id: number;
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
        <div className="spaced-top">
          <Link href="/search" className="btn btn-secondary">Back to search</Link>
        </div>
      </main>
    );
  }

  const car = data.listing;

  return (
    <main className="page shell two-col">
      <section className="panel">
        <header className="listing-head">
          <h1 className="listing-title">{car.title_ar}</h1>
          <p className="car-price">{priceFormatter.format(car.price_sar)} SAR</p>
          <OwnerActions ownerId={car.owner_id} carId={car.id} />
        </header>

        {car.photos?.length ? (
          <div className="photo-grid">
            {car.photos.map((photo) => (
              <img key={photo.id} src={photo.public_url} alt={car.title_ar} loading="lazy" />
            ))}
          </div>
        ) : (
          <div className="notice spaced-top-sm">No photos yet.</div>
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

        <div className="panel panel-soft">
          <h2 className="subheading">Description</h2>
          <p className="body-copy">{car.description_ar}</p>
        </div>
      </section>

      <aside className="panel">
        <h2 className="subheading">Contact Seller</h2>
        <div className="contact-actions">
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

        <hr className="separator" />

        <h3 className="subheading">In-App Chat</h3>
        <ChatPanel carId={car.id} />
      </aside>
    </main>
  );
}
