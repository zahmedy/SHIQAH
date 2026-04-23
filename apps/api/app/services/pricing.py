from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path
import re
import warnings

import joblib
import numpy as np
from sklearn.exceptions import InconsistentVersionWarning

from app.schemas.car import PricePredictionRequest

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml_models" / "pricing_model.pkl"
MODEL_TE_METADATA_PATH = Path(__file__).resolve().parent.parent / "ml_models" / "pricing_model_te.json"
MODEL_TE_GLOBAL_MEAN = 16237.695134782474
REFERENCE_YEAR = 2026

FEATURE_NAMES = (
    "Prod. year",
    "Engine volume",
    "Mileage",
    "Cylinders",
    "Gear box type",
    "car_age",
    "Engine Displacement",
    "Miles per year",
    "Manufacturer_Audi",
    "Manufacturer_BMW",
    "Manufacturer_Chevrolet",
    "Manufacturer_Ford",
    "Manufacturer_Honda",
    "Manufacturer_Hyundai",
    "Manufacturer_Kia",
    "Manufacturer_Lexus",
    "Manufacturer_Mazda",
    "Manufacturer_Mercedes-Benz",
    "Manufacturer_Mitsubishi",
    "Manufacturer_Nissan",
    "Manufacturer_Subaru",
    "Manufacturer_Toyota",
    "Manufacturer_Volkswagen",
    "Manufacturer_other",
    "Color_Beige",
    "Color_Black",
    "Color_Blue",
    "Color_Brown",
    "Color_Gold",
    "Color_Gray",
    "Color_Green",
    "Color_Orange",
    "Color_Purple",
    "Color_Red",
    "Color_Silver",
    "Color_White",
    "Category_Coupe",
    "Category_Hatchback",
    "Category_Pickup",
    "Category_SUV",
    "Category_Sedan",
    "Category_Van",
    "Category_Wagon",
    "Fuel type_Diesel",
    "Fuel type_Hybrid",
    "Fuel type_Petrol",
    "Drive wheels_AWD",
    "Drive wheels_FWD",
    "Drive wheels_RWD",
    "Model_te",
)

COLOR_MAP = {
    "Silver": "Silver",
    "Black": "Black",
    "White": "White",
    "Grey": "Gray",
    "Gray": "Gray",
    "Blue": "Blue",
    "Sky blue": "Blue",
    "Green": "Green",
    "Red": "Red",
    "Carnelian red": "Red",
    "Orange": "Orange",
    "Yellow": "Gold",
    "Brown": "Brown",
    "Golden": "Gold",
    "Gold": "Gold",
    "Beige": "Beige",
    "Purple": "Purple",
    "Pink": "Red",
}

BODY_TYPE_MAP = {
    "Jeep": "SUV",
    "Hatchback": "Hatchback",
    "Sedan": "Sedan",
    "Microbus": "Van",
    "Goods wagon": "Van",
    "Universal": "Wagon",
    "Coupe": "Coupe",
    "Minivan": "Van",
    "Cabriolet": "Convertible",
    "Limousine": "Sedan",
    "Pickup": "Pickup",
}

GEARBOX_TYPE_MAP = {
    "Automatic": "Automatic",
    "Tiptronic": "Automatic",
    "Variator": "Automatic",
    "Manual": "Manual",
}

GEARBOX_VALUE_MAP = {
    "Manual": 1.0,
    "Automatic": 0.0,
}

DRIVE_WHEELS_MAP = {
    "4x4": "AWD",
    "Front": "FWD",
    "Rear": "RWD",
    "AWD": "AWD",
    "FWD": "FWD",
    "RWD": "RWD",
    "4WD": "AWD",
}

FUEL_TYPE_MAP = {
    "Hybrid": "Hybrid",
    "Plug-in Hybrid": "Hybrid",
    "Petrol": "Petrol",
    "Diesel": "Diesel",
    "CNG": "Petrol",
    "LPG": "Petrol",
    "Hydrogen": "Electric",
}

SUPPORTED_MAKES = [
    "Toyota", "Hyundai", "Nissan", "Kia", "Honda", "Lexus", "GMC",
    "Chevrolet", "Ford", "Tesla", "BMW", "Mercedes-Benz", "Mitsubishi",
    "Land Rover", "Jeep", "Dodge", "Ram", "Volkswagen", "Audi", "Mazda",
    "Infiniti", "Cadillac", "Subaru",
]

MAKE_LOOKUP = {make.lower(): make for make in SUPPORTED_MAKES}

SUPPORTED_MODELS_BY_MAKE = {
    "Toyota": [
        "Camry", "Corolla", "RAV4", "Highlander", "4Runner", "Tacoma", "Tundra",
        "Prius", "Prius C", "Prius V", "Sienna", "Sequoia", "Land Cruiser",
        "Land Cruiser Prado", "Crown", "Avalon", "C-HR", "Aqua", "Vitz",
        "Ist", "VOXY",
    ],
    "Hyundai": [
        "Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Venue",
        "Santa Cruz", "Ioniq 5", "Ioniq 6", "Accent", "Genesis", "Grandeur",
        "Veloster", "i30", "H1",
    ],
    "Nissan": [
        "Altima", "Sentra", "Versa", "Rogue", "Murano", "Pathfinder", "Armada",
        "Frontier", "Leaf", "Kicks", "Z", "Juke", "Tiida", "Note", "March",
        "X-Trail", "Xterra", "Serena", "Skyline",
    ],
    "Kia": [
        "K4", "K5", "Forte", "Soul", "Seltos", "Sportage", "Sorento",
        "Telluride", "Carnival", "EV6", "EV9", "Optima", "Rio", "Picanto",
        "Cerato",
    ],
    "Honda": [
        "Accord", "Civic", "CR-V", "HR-V", "Pilot", "Odyssey", "Passport",
        "Ridgeline", "Prologue", "Fit", "Insight", "Elysion",
    ],
    "Lexus": [
        "RX 350", "RX 450", "NX 350", "ES 350", "ES 300", "GX 550", "GX 460",
        "GX 470", "LX 600", "LS 500", "LS 460", "IS 350", "IS 250",
        "RC 350", "TX 350", "UX 300h", "CT 200h", "HS 250h",
    ],
    "GMC": [
        "Terrain", "Acadia", "Yukon", "Yukon XL", "Canyon", "Sierra 1500",
        "Sierra HD", "Hummer EV",
    ],
    "Chevrolet": [
        "Trax", "Trailblazer", "Equinox", "Blazer", "Traverse", "Tahoe",
        "Suburban", "Colorado", "Silverado 1500", "Malibu", "Corvette",
        "Cruze", "Captiva", "Volt", "Orlando", "Spark", "Aveo", "Impala",
        "Camaro",
    ],
    "Ford": [
        "Maverick", "Ranger", "F-150", "Mustang", "Escape", "Bronco Sport",
        "Bronco", "Explorer", "Expedition", "Transit", "Fusion", "Focus",
        "Fiesta", "Taurus", "Transit Connect",
    ],
    "Tesla": [
        "Model 3", "Model Y", "Model S", "Model X", "Cybertruck",
    ],
    "BMW": [
        "2 Series", "3 Series", "4 Series", "5 Series", "7 Series",
        "X1", "X3", "X5", "X6", "X7", "i4", "iX",
    ],
    "Mercedes-Benz": [
        "C-Class", "E-Class", "S-Class", "CLA", "CLS", "GLA", "GLC",
        "GLE", "GLS", "GL", "ML", "EQB", "EQE", "G-Class", "Sprinter", "Vito",
    ],
    "Mitsubishi": [
        "Mirage", "Outlander", "Outlander Sport", "Eclipse Cross",
        "Pajero", "Pajero iO", "Airtrek", "Colt",
    ],
    "Land Rover": [
        "Range Rover", "Range Rover Sport", "Range Rover Velar",
        "Range Rover Evoque", "Discovery", "Defender",
    ],
    "Jeep": [
        "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator",
        "Wagoneer", "Grand Wagoneer",
    ],
    "Dodge": [
        "Hornet", "Durango", "Charger", "Challenger", "Caliber",
    ],
    "Ram": [
        "1500", "2500", "3500", "ProMaster",
    ],
    "Volkswagen": [
        "Jetta", "Taos", "Tiguan", "Atlas", "Atlas Cross Sport",
        "Golf GTI", "Golf R", "Golf", "ID.4", "Passat", "CC",
    ],
    "Audi": [
        "A3", "A4", "A5", "A6", "A7", "Q3", "Q5", "Q7", "Q8",
        "e-tron", "Q4 e-tron",
    ],
    "Mazda": [
        "Mazda3", "Mazda6", "CX-30", "CX-5", "CX-9", "CX-50",
        "CX-70", "CX-90", "MX-5 Miata", "MPV", "Demio",
    ],
    "Infiniti": [
        "Q50", "QX50", "QX55", "QX60", "QX80",
    ],
    "Cadillac": [
        "CT4", "CT5", "XT4", "XT5", "XT6", "Escalade", "Lyriq", "Optiq",
    ],
    "Subaru": [
        "Impreza", "Legacy", "WRX", "Crosstrek", "Forester", "Outback",
        "Ascent", "BRZ", "Solterra", "XV",
    ],
}

MODEL_ALIASES = {
    "rav4": "RAV4",
    "rav 4": "RAV4",
    "chr": "C-HR",
    "camryse": "Camry",
    "camryxle": "Camry",
    "priusc": "Prius C",
    "priusv": "Prius V",
    "landcruiserprado": "Land Cruiser Prado",
    "h1": "H1",
    "i30": "i30",
    "xtrail": "X-Trail",
    "xterra": "Xterra",
    "xterraa": "Xterra",
    "rio": "Rio",
    "gx460": "GX 460",
    "gx470": "GX 470",
    "rx450": "RX 450",
    "es300": "ES 300",
    "ls460": "LS 460",
    "is250": "IS 250",
    "ct200h": "CT 200h",
    "hs250h": "HS 250h",
    "cruzelt": "Cruze",
    "silverado1500": "Silverado 1500",
    "f150": "F-150",
    "transitconnect": "Transit Connect",
    "model3": "Model 3",
    "modely": "Model Y",
    "models": "Model S",
    "modelx": "Model X",
    "328": "3 Series",
    "320": "3 Series",
    "318": "3 Series",
    "330": "3 Series",
    "335": "3 Series",
    "525": "5 Series",
    "528": "5 Series",
    "530": "5 Series",
    "535": "5 Series",
    "550": "5 Series",
    "c300": "C-Class",
    "c250": "C-Class",
    "c200": "C-Class",
    "c180": "C-Class",
    "e350": "E-Class",
    "e300": "E-Class",
    "e320": "E-Class",
    "e200": "E-Class",
    "s550": "S-Class",
    "gla250": "GLA",
    "gle350": "GLE",
    "gl450": "GL",
    "ml350": "ML",
    "cla250": "CLA",
    "cls550": "CLS",
    "pajeroio": "Pajero iO",
    "golf": "Golf",
    "golfgti": "Golf GTI",
    "golfr": "Golf R",
    "mazda6": "Mazda6",
    "cx9": "CX-9",
    "xv": "XV",
}

def _normalize_text(value: str) -> str:
    next_value = str(value).strip().lower()
    next_value = next_value.replace("–", "-").replace("—", "-")
    next_value = re.sub(r"[^a-z0-9\\s\\-]", "", next_value)
    return re.sub(r"\\s+", " ", next_value).strip()


def _make_model_key(value: str) -> str:
    next_value = _normalize_text(value)
    return next_value.replace("-", "").replace(" ", "")


SUPPORTED_MODEL_LOOKUP_BY_MAKE = {
    make: {_make_model_key(model): model for model in models}
    for make, models in SUPPORTED_MODELS_BY_MAKE.items()
}


def _normalize_make(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    return MAKE_LOOKUP.get(normalized)


def _normalize_color(value: str | None) -> str | None:
    if not value:
        return None
    return COLOR_MAP.get(value.strip())


def _normalize_body_type(value: str | None) -> str | None:
    if not value:
        return None
    return BODY_TYPE_MAP.get(value.strip())


def _normalize_transmission(value: str | None) -> str | None:
    if not value:
        return None
    return GEARBOX_TYPE_MAP.get(value.strip())


def _normalize_drivetrain(value: str | None) -> str | None:
    if not value:
        return None
    return DRIVE_WHEELS_MAP.get(value.strip())


def _normalize_fuel_type(value: str | None) -> str | None:
    if not value:
        return None
    return FUEL_TYPE_MAP.get(value.strip())


def _canonicalize_model(make: str | None, raw_model: str | None) -> str | None:
    if not make or not raw_model:
        return None

    raw_key = _make_model_key(raw_model)
    if not raw_key:
        return None

    if raw_key in MODEL_ALIASES:
        return MODEL_ALIASES[raw_key]

    model_lookup = SUPPORTED_MODEL_LOOKUP_BY_MAKE.get(make, {})
    direct_match = model_lookup.get(raw_key)
    if direct_match:
        return direct_match

    for model_key, canonical_model in sorted(model_lookup.items(), key=lambda item: len(item[0]), reverse=True):
        if raw_key.startswith(model_key):
            return canonical_model
    return None


def _normalize_engine_volume(value: float | None) -> float:
    if value is None:
        return 0.0
    return float(value)


@lru_cache(maxsize=1)
def _load_model():
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Pricing model not found at {MODEL_PATH}.")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", InconsistentVersionWarning)
        model = joblib.load(MODEL_PATH, mmap_mode="r")

    # Prediction does not benefit from using every CPU here, and lower parallelism
    # reduces memory pressure when the forest is very large.
    if hasattr(model, "n_jobs"):
        model.n_jobs = 1

    expected_features = tuple(getattr(model, "feature_names_in_", ()))
    if expected_features and expected_features != FEATURE_NAMES:
        raise RuntimeError("Pricing model features do not match the API feature map.")
    return model


@lru_cache(maxsize=1)
def _load_model_te_metadata() -> tuple[float, dict[str, float]]:
    if not MODEL_TE_METADATA_PATH.exists():
        return MODEL_TE_GLOBAL_MEAN, {}

    with MODEL_TE_METADATA_PATH.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, dict):
        raise RuntimeError("pricing_model_te.json must be a JSON object.")

    raw_global_mean = payload.get("global_mean", MODEL_TE_GLOBAL_MEAN)
    raw_model_means = payload.get("model_means", {})
    if not isinstance(raw_model_means, dict):
        raise RuntimeError("pricing_model_te.json model_means must be an object.")

    global_mean = float(raw_global_mean)
    model_means = {
        str(key).strip(): float(value)
        for key, value in raw_model_means.items()
        if str(key).strip()
    }
    return global_mean, model_means


def _resolve_model_te(model_name: str) -> float:
    global_mean, model_means = _load_model_te_metadata()
    direct_match = model_means.get(model_name)
    if direct_match is not None:
        return direct_match

    lowered_name = model_name.lower()
    for key, value in model_means.items():
        if key.lower() == lowered_name:
            return value
    return global_mean


def _build_feature_vector(payload: PricePredictionRequest) -> np.ndarray:
    make = _normalize_make(payload.make)
    model_name = _canonicalize_model(make, payload.model) or "other"
    color = _normalize_color(payload.color)
    body_type = _normalize_body_type(payload.body_type)
    transmission = _normalize_transmission(payload.transmission)
    drivetrain = _normalize_drivetrain(payload.drivetrain)
    fuel_type = _normalize_fuel_type(payload.fuel_type)
    mileage_value = float(payload.mileage_km or 0.0)
    car_age = max(0.0, float(REFERENCE_YEAR - payload.year))
    miles_per_year = mileage_value / max(1.0, car_age)
    engine_volume = _normalize_engine_volume(payload.engine_volume)
    cylinders = float(payload.engine_cylinders or 0.0)

    features = {name: 0.0 for name in FEATURE_NAMES}
    features["Prod. year"] = float(payload.year)
    features["Engine volume"] = engine_volume
    features["Mileage"] = mileage_value
    features["Cylinders"] = cylinders
    features["Gear box type"] = GEARBOX_VALUE_MAP.get(transmission, 0.0)
    features["car_age"] = car_age
    features["Engine Displacement"] = engine_volume * cylinders
    features["Miles per year"] = miles_per_year
    features["Model_te"] = _resolve_model_te(model_name)

    if make:
        key = f"Manufacturer_{make}"
        features[key if key in features else "Manufacturer_other"] = 1.0
    else:
        features["Manufacturer_other"] = 1.0

    if color:
        key = f"Color_{color}"
        if key in features:
            features[key] = 1.0

    if body_type:
        key = f"Category_{body_type}"
        if key in features:
            features[key] = 1.0

    if fuel_type:
        key = f"Fuel type_{fuel_type}"
        if key in features:
            features[key] = 1.0

    if drivetrain:
        key = f"Drive wheels_{drivetrain}"
        if key in features:
            features[key] = 1.0

    return np.array([[features[name] for name in FEATURE_NAMES]], dtype=float)


def generate_price_prediction(payload: PricePredictionRequest) -> int:
    model = _load_model()
    feature_vector = _build_feature_vector(payload)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        predicted_price = float(model.predict(feature_vector)[0])
    if predicted_price <= 0:
        raise RuntimeError("Pricing model returned an invalid prediction.")
    return int(round(predicted_price))
