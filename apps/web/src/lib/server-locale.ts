import type { Locale } from "@/lib/locale";

export async function getServerLocale(): Promise<Locale> {
  return "en";
}
