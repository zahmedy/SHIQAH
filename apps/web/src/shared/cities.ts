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

// Approximate city centre coordinates (WGS-84)
const CITY_COORDS: Record<string, [number, number]> = {
  Riyadh:          [24.6877, 46.7219],
  Jeddah:          [21.4858, 39.1925],
  Makkah:          [21.4225, 39.8262],
  Madinah:         [24.5247, 39.5692],
  Dammam:          [26.4207, 50.0888],
  Khobar:          [26.2172, 50.1971],
  Dhahran:         [26.2967, 50.1538],
  Taif:            [21.2854, 40.4152],
  Abha:            [18.2164, 42.5053],
  "Khamis Mushait":[18.2993, 42.7237],
  Jazan:           [16.8892, 42.5611],
  Tabuk:           [28.3838, 36.5550],
  Buraidah:        [26.3260, 43.9750],
  Hail:            [27.5114, 41.6905],
  Najran:          [17.4924, 44.1277],
  Jubail:          [27.0046, 49.6605],
  "Al Ahsa":       [25.3713, 49.5870],
  Yanbu:           [24.0895, 38.0618],
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the nearest major city to the given coordinates, or null if all
 * cities are farther than `maxKm` (default 400 km).
 */
export function findNearestCity(lat: number, lon: number, maxKm = 400): string | null {
  let nearest: string | null = null;
  let nearestDist = Infinity;

  for (const city of MAJOR_CITIES) {
    const coords = CITY_COORDS[city];
    if (!coords) continue;
    const dist = haversineKm(lat, lon, coords[0], coords[1]);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = city;
    }
  }

  return nearestDist <= maxKm ? nearest : null;
}

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
