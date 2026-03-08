import Link from "next/link";

export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">GARAG</h1>
      <p>Car marketplace MVP</p>
      <Link href="/search" className="border rounded px-4 py-2 inline-block">
        Go to search
      </Link>
    </main>
  );
}