"use client";

import { LOCALE_COOKIE, type Locale } from "@/lib/locale";
import { useLocale } from "@/components/LocaleProvider";

export default function LocaleSwitch() {
  const locale = useLocale();
  const nextLocale: Locale = locale === "ar" ? "en" : "ar";
  const isEnglish = locale === "en";

  function handleToggle() {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <button
      type="button"
      className={`locale-toggle${isEnglish ? " locale-toggle-english" : ""}`}
      onClick={handleToggle}
      aria-label={isEnglish ? "Switch to Arabic" : "Switch to English"}
      aria-pressed={isEnglish}
    >
      <span className={`locale-toggle-thumb${isEnglish ? " locale-toggle-thumb-english" : ""}`} aria-hidden="true" />
      <span className={`locale-toggle-option locale-toggle-option-ar${!isEnglish ? " locale-toggle-option-active" : ""}`}>
        AR
      </span>
      <span className={`locale-toggle-option locale-toggle-option-en${isEnglish ? " locale-toggle-option-active" : ""}`}>
        <span className="locale-toggle-flag" aria-hidden="true">🇺🇸</span>
        EN
      </span>
    </button>
  );
}
