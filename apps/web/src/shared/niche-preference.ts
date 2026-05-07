export const NICHE_COOKIE_NAME = "nicherides_niche";
export const NICHE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function nicheCookieValue(): string | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${NICHE_COOKIE_NAME}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
}

export function saveNichePreference(nicheId: string) {
  if (typeof document === "undefined") return;

  document.cookie = `${NICHE_COOKIE_NAME}=${encodeURIComponent(nicheId)}; path=/; max-age=${NICHE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
