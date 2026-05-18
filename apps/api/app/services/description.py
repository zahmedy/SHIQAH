from app.schemas.car import DescriptionFillRequest


def _clean_text(value: object | None) -> str:
    return " ".join(str(value or "").strip().split())


def _format_money(value: int | None) -> str:
    if value is None:
        return ""
    return f"${value:,}"


def _format_mileage(value: int | None) -> str:
    if value is None:
        return ""
    return f"{value:,} mi"


def _format_engine_volume(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:g}L"


def _format_fuel_type(value: str | None) -> str:
    fuel_type = _clean_text(value)
    if fuel_type.lower() == "petrol":
        return "Gasoline"
    return fuel_type


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(value)
    return unique


def _looks_generated_description(value: str) -> bool:
    return value.startswith("Year: ") and ". Make: " in value and ". Model: " in value


def generate_listing_description(payload: DescriptionFillRequest) -> str:
    year_make_model = " ".join(
        value
        for value in [str(payload.year), _clean_text(payload.make), _clean_text(payload.model)]
        if value
    )
    location = ", ".join(
        value
        for value in [_clean_text(payload.district), _clean_text(payload.city)]
        if value
    )
    highlights = _dedupe([_clean_text(value) for value in payload.seller_highlights if _clean_text(value)])
    useful_facts = _dedupe(
        [
            _clean_text(payload.condition),
            _format_mileage(payload.mileage),
            _clean_text(payload.drivetrain),
            _format_fuel_type(payload.fuel_type),
        ]
    )

    sentences = []
    opener = f"{year_make_model} available"
    if location:
        opener += f" in {location}"
    sentences.append(f"{opener}.")

    if highlights:
        sentences.append(f"Seller-confirmed highlights: {', '.join(highlights[:4])}.")
    if useful_facts:
        sentences.append(f"Key details: {', '.join(useful_facts[:4])}.")

    existing_description = _clean_text(payload.description)
    if existing_description and not _looks_generated_description(existing_description):
        sentences.append(existing_description)

    sentences.append("Message the seller for condition details, maintenance history, and a test drive.")

    return " ".join(sentences)
