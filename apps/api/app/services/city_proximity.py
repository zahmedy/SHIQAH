from math import asin, cos, radians, sin, sqrt


CITY_COORDINATES: dict[str, tuple[float, float]] = {
    "Riyadh": (24.7136, 46.6753),
    "Jeddah": (21.5433, 39.1728),
    "Makkah": (21.3891, 39.8579),
    "Madinah": (24.5247, 39.5692),
    "Dammam": (26.4207, 50.0888),
    "Khobar": (26.2794, 50.2083),
    "Dhahran": (26.2886, 50.1139),
    "Taif": (21.2703, 40.4158),
    "Abha": (18.2465, 42.5117),
    "Khamis Mushait": (18.3000, 42.7333),
    "Jazan": (16.8892, 42.5511),
    "Tabuk": (28.3838, 36.5662),
    "Buraidah": (26.3260, 43.9750),
    "Hail": (27.5219, 41.6907),
    "Najran": (17.5650, 44.2289),
    "Jubail": (27.0174, 49.6225),
    "Al Ahsa": (25.3830, 49.5862),
    "Yanbu": (24.0895, 38.0618),
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
