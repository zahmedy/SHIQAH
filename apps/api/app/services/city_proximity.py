from math import asin, cos, radians, sin, sqrt


CITY_COORDINATES: dict[str, tuple[float, float]] = {
    "New York": (40.7128, -74.0060),
    "Los Angeles": (34.0522, -118.2437),
    "Chicago": (41.8781, -87.6298),
    "Houston": (29.7604, -95.3698),
    "Phoenix": (33.4484, -112.0740),
    "Philadelphia": (39.9526, -75.1652),
    "San Antonio": (29.4241, -98.4936),
    "San Diego": (32.7157, -117.1611),
    "Dallas": (32.7767, -96.7970),
    "Austin": (30.2672, -97.7431),
    "Jacksonville": (30.3322, -81.6557),
    "Columbus": (39.9612, -82.9988),
    "Charlotte": (35.2271, -80.8431),
    "Indianapolis": (39.7684, -86.1581),
    "Seattle": (47.6062, -122.3321),
    "Denver": (39.7392, -104.9903),
    "Boston": (42.3601, -71.0589),
    "Miami": (25.7617, -80.1918),
    "Atlanta": (33.7490, -84.3880),
    "Washington": (38.9072, -77.0369),
    "San Francisco": (37.7749, -122.4194),
    "San Jose": (37.3382, -121.8863),
    "Sacramento": (38.5816, -121.4944),
    "Portland": (45.5152, -122.6784),
    "Las Vegas": (36.1699, -115.1398),
    "Salt Lake City": (40.7608, -111.8910),
    "Minneapolis": (44.9778, -93.2650),
    "Kansas City": (39.0997, -94.5786),
    "St. Louis": (38.6270, -90.1994),
    "Detroit": (42.3314, -83.0458),
    "Nashville": (36.1627, -86.7816),
    "New Orleans": (29.9511, -90.0715),
    "Tampa": (27.9506, -82.4572),
    "Orlando": (28.5383, -81.3792),
    "Raleigh": (35.7796, -78.6382),
    "Cleveland": (41.4993, -81.6944),
    "Pittsburgh": (40.4406, -79.9959),
    "Cincinnati": (39.1031, -84.5120),
    "Milwaukee": (43.0389, -87.9065),
    "Baltimore": (39.2904, -76.6122),
    "Buffalo": (42.8864, -78.8784),
    "Richmond": (37.5407, -77.4360),
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    start_lat = radians(lat1)
    end_lat = radians(lat2)

    a = sin(dlat / 2) ** 2 + cos(start_lat) * cos(end_lat) * sin(dlon / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(a))


def nearby_cities(lat: float, lon: float, radius_km: int) -> list[str]:
    matches = [
        city
        for city, (city_lat, city_lon) in CITY_COORDINATES.items()
        if _haversine_km(lat, lon, city_lat, city_lon) <= radius_km
    ]

    if matches:
        return matches

    nearest_city = min(
        CITY_COORDINATES.items(),
        key=lambda item: _haversine_km(lat, lon, item[1][0], item[1][1]),
    )[0]
    return [nearest_city]
