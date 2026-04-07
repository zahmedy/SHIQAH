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
  "San Francisco",
  "San Jose",
  "Sacramento",
  "Portland",
  "Las Vegas",
  "Salt Lake City",
  "Minneapolis",
  "Kansas City",
  "St. Louis",
  "Detroit",
  "Nashville",
  "New Orleans",
  "Tampa",
  "Orlando",
  "Raleigh",
  "Cleveland",
  "Pittsburgh",
  "Cincinnati",
  "Milwaukee",
  "Baltimore",
  "Buffalo",
  "Richmond",
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
  "San Francisco": [37.7749, -122.4194],
  "San Jose": [37.3382, -121.8863],
  Sacramento: [38.5816, -121.4944],
  Portland: [45.5152, -122.6784],
  "Las Vegas": [36.1699, -115.1398],
  "Salt Lake City": [40.7608, -111.8910],
  Minneapolis: [44.9778, -93.2650],
  "Kansas City": [39.0997, -94.5786],
  "St. Louis": [38.6270, -90.1994],
  Detroit: [42.3314, -83.0458],
  Nashville: [36.1627, -86.7816],
  "New Orleans": [29.9511, -90.0715],
  Tampa: [27.9506, -82.4572],
  Orlando: [28.5383, -81.3792],
  Raleigh: [35.7796, -78.6382],
  Cleveland: [41.4993, -81.6944],
  Pittsburgh: [40.4406, -79.9959],
  Cincinnati: [39.1031, -84.5120],
  Milwaukee: [43.0389, -87.9065],
  Baltimore: [39.2904, -76.6122],
  Buffalo: [42.8864, -78.8784],
  Richmond: [37.5407, -77.4360],
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
