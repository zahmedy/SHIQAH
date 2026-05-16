"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function TopbarScrollMode() {
  const pathname = usePathname();

  useEffect(() => {
    const shouldScrollTopbar = pathname === "/my-cars/new" || /^\/my-cars\/[^/]+\/edit$/.test(pathname);
    document.body.classList.toggle("topbar-scrolls-with-page", shouldScrollTopbar);
    return () => {
      document.body.classList.remove("topbar-scrolls-with-page");
    };
  }, [pathname]);

  return null;
}
