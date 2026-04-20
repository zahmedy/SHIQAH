import json
import urllib.parse
import urllib.request


def _clean_value(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    return cleaned or None


def _title_vehicle_value(value: str | None) -> str | None:
    cleaned = _clean_value(value)
    if not cleaned:
        return None
    acronyms = {"BMW", "GMC", "RAM", "MINI", "FIAT"}
    parts = []
    for part in cleaned.split():
        upper_part = part.upper()
        parts.append(upper_part if upper_part in acronyms else part.capitalize())
    return " ".join(parts)


def _map_body_type(value: str | None) -> str | None:
    cleaned = (value or "").lower()
    if "sport utility" in cleaned or "suv" in cleaned or cleaned == "jeep":
        return "SUV"
    if "pickup" in cleaned:
        return "Pickup"
    if "goods wagon" in cleaned or "microbus" in cleaned or "minivan" in cleaned or "van" in cleaned:
        return "Van"
    if "wagon" in cleaned or "universal" in cleaned or "estate" in cleaned:
        return "Wagon"
    if "convertible" in cleaned or "cabriolet" in cleaned or "roadster" in cleaned:
        return "Convertible"
    if "hatchback" in cleaned:
        return "Hatchback"
    if "coupe" in cleaned:
        return "Coupe"
    if "sedan" in cleaned or "saloon" in cleaned or "limousine" in cleaned:
        return "Sedan"
    return None


def _map_fuel_type(value: str | None) -> str | None:
    cleaned = (value or "").lower()
    if "electric" in cleaned:
        return "Electric"
    if "hybrid" in cleaned:
        return "Hybrid"
    if "diesel" in cleaned:
        return "Diesel"
    if "gasoline" in cleaned or "petrol" in cleaned:
        return "Petrol"
    return None


def _map_transmission(value: str | None) -> str | None:
    cleaned = (value or "").lower()
    if "manual" in cleaned:
        return "Manual"
    if "automatic" in cleaned or "cvt" in cleaned:
        return "Automatic"
    return None


def _map_drivetrain(value: str | None) -> str | None:
    cleaned = (value or "").upper()
    if "4WD" in cleaned or "4X4" in cleaned:
        return "4WD"
    if "AWD" in cleaned or "ALL" in cleaned:
        return "AWD"
    if "FWD" in cleaned or "FRONT" in cleaned:
        return "FWD"
    if "RWD" in cleaned or "REAR" in cleaned:
        return "RWD"
    return None


def decode_vin(vin: str) -> dict:
    encoded_vin = urllib.parse.quote(vin)
    url = f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{encoded_vin}?format=json"
    with urllib.request.urlopen(url, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))

    results = payload.get("Results") or []
    result = results[0] if results else {}
    error_code = _clean_value(result.get("ErrorCode"))
    error_text = _clean_value(result.get("ErrorText"))
    if error_code and error_code != "0":
        return {
            "vin": vin,
            "message": error_text or "VIN was detected, but vehicle details could not be decoded.",
        }

    year = None
    model_year = _clean_value(result.get("ModelYear"))
    if model_year and model_year.isdigit():
        year = int(model_year)

    return {
        "vin": vin,
        "make": _title_vehicle_value(result.get("Make")),
        "model": _title_vehicle_value(result.get("Model")),
        "year": year,
        "body_type": _map_body_type(result.get("BodyClass")),
        "transmission": _map_transmission(result.get("TransmissionStyle")),
        "fuel_type": _map_fuel_type(result.get("FuelTypePrimary")),
        "drivetrain": _map_drivetrain(result.get("DriveType")),
        "message": "VIN detected and decoded.",
    }
