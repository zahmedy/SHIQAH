import Link from "next/link";
import { apiGet } from "@/lib/api";

type SearchItem = {
  id: string;
  city: string;
  district?: string;
  make: string;
  model: string;
  year: number;
  price_sar: number;
  mileage_km?: number;
  title_ar: string;
};

type SearchResponse = {
  page: number;
  page_size: number;
  total: number;
  items: SearchItem[];
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    make?: string;
    model?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;

  const qs = new URLSearchParams();
  if (params.city) qs.set("city", params.city);
  if (params.make) qs.set("make", params.make);
  if (params.model) qs.set("model", params.model);
  if (params.q) qs.set("q", params.q);

  const data = await apiGet<SearchResponse>(`/v1/search/cars?${qs.toString()}`);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">GARAG Search</h1>

      <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="بحث"
          className="border rounded px-3 py-2"
        />
        <input
          name="city"
          defaultValue={params.city ?? ""}
          placeholder="المدينة"
          className="border rounded px-3 py-2"
        />
        <input
          name="make"
          defaultValue={params.make ?? ""}
          placeholder="الشركة"
          className="border rounded px-3 py-2"
        />
        <input
          name="model"
          defaultValue={params.model ?? ""}
          placeholder="الموديل"
          className="border rounded px-3 py-2"
        />
        <button className="border rounded px-4 py-2 w-full md:w-auto">
          Search
        </button>
      </form>

      <div className="text-sm text-gray-600">Total: {data.total}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.items.map((car) => (
          <Link
            key={car.id}
            href={`/cars/${car.id}`}
            className="border rounded-xl p-4 space-y-2 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">{car.title_ar}</div>
            <div>
              {car.make} {car.model} {car.year}
            </div>
            <div>{car.city}{car.district ? ` - ${car.district}` : ""}</div>
            <div>{car.mileage_km ? `${car.mileage_km} km` : "—"}</div>
            <div className="text-xl font-bold">{car.price_sar.toLocaleString()} SAR</div>
          </Link>
        ))}
      </div>
    </main>
  );
}