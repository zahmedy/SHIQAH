export const OTHER_CITY_VALUE = "__other__";

export const MAJOR_CITIES = [
  "Riyadh",
  "Jeddah",
  "Makkah",
  "Madinah",
  "Dammam",
  "Khobar",
  "Dhahran",
  "Taif",
  "Abha",
  "Khamis Mushait",
  "Jazan",
  "Tabuk",
  "Buraidah",
  "Hail",
  "Najran",
  "Jubail",
  "Al Ahsa",
  "Yanbu",
];

export function isMajorCity(city?: string | null): boolean {
  const normalized = city?.trim() ?? "";
  return MAJOR_CITIES.includes(normalized);
}

export function getCitySelectValue(city?: string | null): string {
  const normalized = city?.trim() ?? "";
  if (!normalized) {
    return "";
  }
  return isMajorCity(normalized) ? normalized : OTHER_CITY_VALUE;
}
