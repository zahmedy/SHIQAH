from __future__ import annotations

import re
from typing import Any


BUDGET_PRICE_MAX = 15000
LOW_MILEAGE_MAX = 80000
NEWER_YEAR_MIN = 2020

ALLOWED_BODY_TYPES = {
    "sedan": "Sedan",
    "suv": "SUV",
    "coupe": "Coupe",
    "hatchback": "Hatchback",
    "pickup": "Pickup",
    "truck": "Pickup",
    "van": "Van",
    "minivan": "Van",
    "wagon": "Wagon",
    "convertible": "Convertible",
}

ALLOWED_FUEL_TYPES = {
    "petrol": "Petrol",
    "gas": "Petrol",
    "gasoline": "Petrol",
    "hybrid": "Hybrid",
    "electric": "Electric",
    "ev": "Electric",
    "diesel": "Diesel",
}

ALLOWED_DRIVETRAINS = {
    "awd": "AWD",
    "4wd": "AWD",
    "4x4": "AWD",
    "fwd": "FWD",
    "front wheel": "FWD",
    "front-wheel": "FWD",
    "rwd": "RWD",
    "rear wheel": "RWD",
    "rear-wheel": "RWD",
}

ALLOWED_TRANSMISSIONS = {
    "automatic": "Automatic",
    "manual": "Manual",
}

SUPPORTED_MAKES = {
    "toyota": "Toyota",
    "hyundai": "Hyundai",
    "nissan": "Nissan",
    "kia": "Kia",
    "honda": "Honda",
    "lexus": "Lexus",
    "gmc": "GMC",
    "chevrolet": "Chevrolet",
    "chevy": "Chevrolet",
    "ford": "Ford",
    "tesla": "Tesla",
    "bmw": "BMW",
    "mercedes": "Mercedes-Benz",
    "mercedes-benz": "Mercedes-Benz",
    "mitsubishi": "Mitsubishi",
    "land rover": "Land Rover",
    "jeep": "Jeep",
    "dodge": "Dodge",
    "ram": "Ram",
    "volkswagen": "Volkswagen",
    "vw": "Volkswagen",
    "audi": "Audi",
    "mazda": "Mazda",
    "infiniti": "Infiniti",
    "cadillac": "Cadillac",
    "subaru": "Subaru",
}

def _as_positive_int(value: Any, *, maximum: int | None = None) -> int | None:
    if value in (None, ""):
        return None
    try:
        parsed = int(float(str(value).replace(",", "").strip()))
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    if maximum is not None and parsed > maximum:
        return maximum
    return parsed


def _parse_money_amount(raw_value: str, suffix: str | None) -> int | None:
    try:
        amount = float(raw_value.replace(",", ""))
    except ValueError:
        return None
    if suffix and suffix.lower() == "k":
        amount *= 1000
    elif amount < 1000:
        amount *= 1000
    parsed = int(amount)
    return parsed if parsed > 0 else None


def _canonical_from_text(text: str, allowed: dict[str, str]) -> tuple[str | None, str | None]:
    normalized = text.lower()
    for key, value in sorted(allowed.items(), key=lambda item: len(item[0]), reverse=True):
        if re.search(rf"\b{re.escape(key)}\b", normalized):
            return value, key
    return None, None


def _remove_phrase(text: str, phrase: str | None) -> str:
    if not phrase:
        return text
    return re.sub(rf"\b{re.escape(phrase)}\b", " ", text, flags=re.IGNORECASE)


def _cleanup_keywords(text: str) -> list[str]:
    cleaned = re.sub(r"\b(cars?|vehicles?|autos?|please|show|find|search|for|me|near|around)\b", " ", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.-")
    return [cleaned] if cleaned else []


def parse_search_intent(query: str | None) -> dict[str, Any]:
    if not query or not query.strip():
        return {}

    normalized = query.lower()
    intent: dict[str, Any] = {}
    keyword_source = query

    if re.search(r"\b(budget|cheap|affordable|inexpensive|low price|low-price)\b", normalized):
        intent["price_max"] = BUDGET_PRICE_MAX
        intent["sort"] = "price_asc"
        keyword_source = re.sub(
            r"\b(budget|friendly|cheap|affordable|inexpensive|low price|low-price)\b",
            " ",
            keyword_source,
            flags=re.IGNORECASE,
        )

    mileage_under_match = re.search(
        r"\b(?:under|below|less than|max|maximum)\s*([0-9][0-9,]*(?:\.\d+)?)\s*(k)?\s*(?:mi|mile|miles)\b",
        normalized,
    )
    if mileage_under_match:
        mileage_max = _parse_money_amount(mileage_under_match.group(1), mileage_under_match.group(2))
        if mileage_max:
            intent["mileage_max"] = mileage_max
            intent["sort"] = "mileage_asc"
            keyword_source = re.sub(
                r"\b(?:under|below|less than|max|maximum)\s*[0-9][0-9,]*(?:\.\d+)?\s*k?\s*(?:mi|mile|miles)\b",
                " ",
                keyword_source,
                flags=re.IGNORECASE,
            )

    under_match = re.search(r"\b(?:under|below|less than|max|maximum)\s*\$?\s*([0-9][0-9,]*(?:\.\d+)?)\s*(k)?\b", normalized)
    if under_match:
        remaining_text = normalized[under_match.end():under_match.end() + 12]
        looks_like_mileage = bool(re.match(r"\s*(?:mi|mile|miles)\b", remaining_text))
        price_max = None if looks_like_mileage else _parse_money_amount(under_match.group(1), under_match.group(2))
        if price_max:
            intent["price_max"] = price_max
            intent["sort"] = "price_asc"
            keyword_source = re.sub(
                r"\b(?:under|below|less than|max|maximum)\s*\$?\s*[0-9][0-9,]*(?:\.\d+)?\s*k?\b",
                " ",
                keyword_source,
                flags=re.IGNORECASE,
            )

    if re.search(r"\b(low mileage|low miles|under 100k miles|under 100k mi)\b", normalized):
        intent["mileage_max"] = intent.get("mileage_max") or LOW_MILEAGE_MAX
        intent["sort"] = intent.get("sort") or "mileage_asc"
        keyword_source = re.sub(
            r"\b(low mileage|low miles|under 100k miles|under 100k mi)\b",
            " ",
            keyword_source,
            flags=re.IGNORECASE,
        )

    newer_match = re.search(r"\b(?:newer|modern|recent)\b", normalized)
    if newer_match:
        intent["year_min"] = NEWER_YEAR_MIN
        keyword_source = re.sub(r"\b(?:newer|modern|recent)\b", " ", keyword_source, flags=re.IGNORECASE)

    for field_name, allowed in (
        ("body_type", ALLOWED_BODY_TYPES),
        ("fuel_type", ALLOWED_FUEL_TYPES),
        ("drivetrain", ALLOWED_DRIVETRAINS),
        ("transmission", ALLOWED_TRANSMISSIONS),
    ):
        value, phrase = _canonical_from_text(query, allowed)
        if value:
            intent[field_name] = value
            keyword_source = _remove_phrase(keyword_source, phrase)

    make, make_phrase = _canonical_from_text(query, SUPPORTED_MAKES)
    if make:
        intent["make"] = make
        keyword_source = _remove_phrase(keyword_source, make_phrase)

    year_match = re.search(r"\b(19[8-9][0-9]|20[0-3][0-9])\b", keyword_source)
    if year_match:
        year = _as_positive_int(year_match.group(1), maximum=2100)
        if year:
            intent["year_min"] = intent.get("year_min") or year
            intent["year_max"] = intent.get("year_max") or year
            keyword_source = _remove_phrase(keyword_source, year_match.group(1))

    keywords = _cleanup_keywords(keyword_source)
    if keywords:
        intent["keywords"] = keywords

    return intent
