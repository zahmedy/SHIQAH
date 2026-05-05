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


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(value)
    return unique


def _looks_generated_description(value: str) -> bool:
    return value.startswith("Year: ") and ". Make: " in value and ". Model: " in value


def generate_listing_description(payload: DescriptionFillRequest) -> str:
    details = [
        ("Year", str(payload.year)),
        ("Make", _clean_text(payload.make)),
        ("Model", _clean_text(payload.model)),
        ("Body type", _clean_text(payload.body_type)),
        ("Color", _clean_text(payload.color)),
        ("Transmission", _clean_text(payload.transmission)),
        ("Fuel type", _clean_text(payload.fuel_type)),
        ("Drivetrain", _clean_text(payload.drivetrain)),
        ("Condition", _clean_text(payload.condition)),
        ("Engine cylinders", str(payload.engine_cylinders) if payload.engine_cylinders else ""),
        ("Engine volume", _format_engine_volume(payload.engine_volume)),
        ("Mileage", _format_mileage(payload.mileage)),
        ("Price", _format_money(payload.price)),
        ("City", _clean_text(payload.city)),
        ("District", _clean_text(payload.district)),
    ]
    sentences = [f"{label}: {value}." for label, value in details if value]

    title = _clean_text(payload.title)
    if title:
        sentences.append(f"Title: {title}.")

    highlights = _dedupe([_clean_text(value) for value in payload.seller_highlights if _clean_text(value)])
    if highlights:
        sentences.append(f"Seller-confirmed highlights: {', '.join(highlights)}.")

    existing_description = _clean_text(payload.description)
    if existing_description and not _looks_generated_description(existing_description):
        sentences.append(f"Seller note: {existing_description}")

    return " ".join(sentences)
