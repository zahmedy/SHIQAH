export const OTHER_CITY_VALUE = "__other__";

export const MAJOR_CITIES = [
  "New York",
  "Los Angeles",
  "Chicago",
  "Houston",
  "Phoenix",
  "Philadelphia",
  "San Antonio",
  "San Diego",
  "Dallas",
  "Austin",
  "Jacksonville",
  "Columbus",
  "Charlotte",
  "Indianapolis",
  "Seattle",
  "Denver",
  "Boston",
  "Miami",
  "Atlanta",
  "Washington",
];

const CITY_COORDS: Record<string, [number, number]> = {
  "New York": [40.7128, -74.0060],
  "Los Angeles": [34.0522, -118.2437],
  Chicago: [41.8781, -87.6298],
  Houston: [29.7604, -95.3698],
  Phoenix: [33.4484, -112.0740],
  Philadelphia: [39.9526, -75.1652],
  "San Antonio": [29.4241, -98.4936],
  "San Diego": [32.7157, -117.1611],
  Dallas: [32.7767, -96.7970],
  Austin: [30.2672, -97.7431],
  Jacksonville: [30.3322, -81.6557],
  Columbus: [39.9612, -82.9988],
  Charlotte: [35.2271, -80.8431],
  Indianapolis: [39.7684, -86.1581],
  Seattle: [47.6062, -122.3321],
  Denver: [39.7392, -104.9903],
  Boston: [42.3601, -71.0589],
  Miami: [25.7617, -80.1918],
  Atlanta: [33.7490, -84.3880],
  Washington: [38.9072, -77.0369],
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
