import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import GlobalNicheSelect from "@/components/GlobalNicheSelect";
import LocaleProvider from "@/components/LocaleProvider";
import LogoMark from "@/components/LogoMark";
import TopbarCreate from "@/components/TopbarCreate";
import TopbarNotifications from "@/components/TopbarNotifications";
import TopbarUser from "@/components/TopbarUser";
import { getDirection } from "@/lib/locale";
import { getServerLocale } from "@/lib/server-locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "NicheRides | Find and Sell Cars",
  description: "NicheRides keeps car search and listing simple with clear details, focused filters, and easy seller tools.",
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
          <header className="topbar">
            <div className="shell topbar-inner">
              <Link href="/" className="brand" aria-label="NicheRides home">
                <LogoMark className="brand-logo" />
              </Link>
              <Suspense
                fallback={
                  <label className="global-niche-select" aria-label="Select niche">
                    <span>Niche</span>
                    <select defaultValue="cold_weather_commuter" disabled>
                      <option value="cold_weather_commuter">Winter Value</option>
                    </select>
                  </label>
                }
              >
                <GlobalNicheSelect />
              </Suspense>
              <form action="/search" method="get" className="topbar-search" role="search">
                <input
                  type="search"
                  name="q"
                  className="input topbar-search-input"
                  placeholder="Search cars, cities, or use cases"
                  aria-label="Search cars"
                />
              </form>
              <nav className="topnav">
                <Link href="/search" className="nav-link topnav-browse">
                  Browse
                </Link>
                <TopbarCreate />
                <TopbarNotifications />
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
