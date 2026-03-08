import type { Metadata } from "next";
import Link from "next/link";

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
        <header className="topbar">
          <div className="shell topbar-inner">
            <Link href="/" className="brand" aria-label="GARAJ home">
              GARAJ
            </Link>
            <nav className="topnav">
              <Link href="/search" className="nav-link">
                Search
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
