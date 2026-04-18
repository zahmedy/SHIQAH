import type { Metadata } from "next";
import Link from "next/link";

import LocaleProvider from "@/components/LocaleProvider";
import LogoMark from "@/components/LogoMark";
import TopbarCreate from "@/components/TopbarCreate";
import TopbarUser from "@/components/TopbarUser";
import { getDirection } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoIntel | Curated Used Cars",
  description: "A smarter marketplace for niche used cars, starting with cold-weather commuter cars.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <LocaleProvider locale={locale}>
          <div className="bg-orb bg-orb-one" aria-hidden="true" />
          <div className="bg-orb bg-orb-two" aria-hidden="true" />
          <header className="topbar">
            <div className="shell topbar-inner">
              <Link href="/" className="brand" aria-label="AutoIntel home">
                <LogoMark className="brand-logo" />
              </Link>
              <form action="/search" method="get" className="topbar-search" role="search">
                <input
                  type="search"
                  name="q"
                  className="input topbar-search-input"
                  placeholder="Search curated cars..."
                  aria-label="Search curated cars"
                />
              </form>
              <nav className="topnav">
                <TopbarCreate />
                <TopbarUser />
              </nav>
            </div>
          </header>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
