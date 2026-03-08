import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page shell">
      <section className="hero">
        <h1>Buy and Sell Used Cars with Confidence</h1>
        <p>
          GARAJ is an Arabic-first marketplace MVP for browsing listings, viewing
          details, and sending direct leads to sellers.
        </p>

        <div className="hero-actions">
          <Link href="/search" className="btn btn-primary">
            Start Searching
          </Link>
          <Link href="/search?city=Riyadh" className="btn btn-secondary">
            Explore Riyadh Cars
          </Link>
        </div>
      </section>

      <h2 className="section-title">What You Can Test Today</h2>
      <section className="stats">
        <article className="stat-card">
          <p className="stat-label">Search Listings</p>
          <p className="stat-value">OpenSearch</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Listing Details</p>
          <p className="stat-value">/public/cars/:id</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Lead Capture</p>
          <p className="stat-value">Form + WhatsApp + Call</p>
        </article>
      </section>
    </main>
  );
}
