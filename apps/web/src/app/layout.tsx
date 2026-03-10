import type { Metadata } from "next";
import Link from "next/link";

import LogoMark from "@/components/LogoMark";
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
              <span className="brand-copy">
                <span className="brand-wordmark">GARAJ</span>
                <span className="brand-tag">Cars Marketplace</span>
              </span>
            </Link>
            <nav className="topnav">
              <Link href="/search" className="nav-link">
                Search
              </Link>
              <Link href="/my-cars" className="nav-link">
                My Cars
              </Link>
              <Link href="/login" className="nav-link">
                Login
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
