import type { Metadata } from "next";
import Link from "next/link";

import LogoMark from "@/components/LogoMark";
import TopbarCreate from "@/components/TopbarCreate";
import TopbarUser from "@/components/TopbarUser";
import "./globals.css";

export const metadata: Metadata = {
  title: "GARAJ",
  description: "Used cars marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="bg-orb bg-orb-one" aria-hidden="true" />
        <div className="bg-orb bg-orb-two" aria-hidden="true" />
        <header className="topbar">
          <div className="shell topbar-inner">
            <Link href="/" className="brand" aria-label="GARAJ home">
              <LogoMark className="brand-logo" />
            </Link>
            <nav className="topnav">
              <form action="/search" method="get" className="topbar-search" role="search">
                <input
                  type="search"
                  name="q"
                  className="input topbar-search-input"
                  placeholder="Search cars..."
                  aria-label="Search cars"
                />
              </form>
              <TopbarCreate />
              <TopbarUser />
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
