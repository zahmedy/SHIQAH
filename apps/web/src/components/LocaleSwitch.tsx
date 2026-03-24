"use client";

import { LOCALE_COOKIE, type Locale } from "@/lib/locale";
import { useLocale } from "@/components/LocaleProvider";

export default function LocaleSwitch() {
  const locale = useLocale();
  const nextLocale: Locale = locale === "ar" ? "en" : "ar";

  function handleToggle() {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <button type="button" className="nav-link" onClick={handleToggle}>
      {locale === "ar" ? "English" : "العربية"}
    </button>
  );
}
