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

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await apiGet<PublicCarResponse>(`/v1/public/cars/${id}`);
  const car = data.listing;

  return (
    <main className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-bold">{car.title_ar}</h1>

        <div className="text-3xl font-bold">{car.price_sar.toLocaleString()} SAR</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {car.photos?.length ? (
            car.photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.public_url}
                alt={car.title_ar}
                className="w-full h-64 object-cover rounded-xl border"
              />
            ))
          ) : (
            <div className="border rounded-xl p-6 text-gray-500">No photos yet</div>
          )}
        </div>

        <div className="border rounded-xl p-4 space-y-2">
          <div><strong>Make:</strong> {car.make}</div>
          <div><strong>Model:</strong> {car.model}</div>
          <div><strong>Year:</strong> {car.year}</div>
          <div><strong>Mileage:</strong> {car.mileage_km ?? "—"}</div>
          <div><strong>City:</strong> {car.city}</div>
          <div><strong>District:</strong> {car.district ?? "—"}</div>
          <div><strong>Transmission:</strong> {car.transmission ?? "—"}</div>
          <div><strong>Fuel:</strong> {car.fuel_type ?? "—"}</div>
          <div><strong>Body Type:</strong> {car.body_type ?? "—"}</div>
          <div><strong>Condition:</strong> {car.condition ?? "—"}</div>
          <div><strong>Color:</strong> {car.color ?? "—"}</div>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Description</h2>
          <p>{car.description_ar}</p>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">Seller Contact</h2>

          {data.contact.call_phone_e164 && (
            <a
              href={`tel:${data.contact.call_phone_e164}`}
              className="block border rounded px-4 py-2 text-center"
            >
              Call
            </a>
          )}

          {data.contact.whatsapp_url && (
            <a
              href={data.contact.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              className="block border rounded px-4 py-2 text-center"
            >
              WhatsApp
            </a>
          )}
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Send Lead</h2>
          <LeadForm carId={car.id} />
        </div>
      </aside>
    </main>
  );
}