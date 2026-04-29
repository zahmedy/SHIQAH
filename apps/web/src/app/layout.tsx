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
  title: "AutoIntel | Sell and Browse Cars",
  description: "AutoIntel helps sellers create cleaner car listings with vehicle details, pricing tools, and a simple marketplace experience.",
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
              <Link href="/" className="brand" aria-label="AutoIntel home">
                <LogoMark className="brand-logo" />
              </Link>
              <form action="/search" method="get" className="topbar-search" role="search">
                <input
                  type="search"
                  name="q"
                  className="input topbar-search-input"
                  placeholder="Search make, model, city, or use case"
                  aria-label="Search cars"
                />
              </form>
              <nav className="topnav">
                <Link href="/search" className="nav-link topnav-browse">
                  Browse cars
                </Link>
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
