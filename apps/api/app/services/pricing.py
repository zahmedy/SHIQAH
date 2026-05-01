from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import re
import sys
import warnings

import joblib
import pandas as pd
from sklearn.exceptions import InconsistentVersionWarning
from sklearn.base import BaseEstimator, TransformerMixin

from app.schemas.car import PricePredictionRequest

ML_MODELS_DIR = Path(__file__).resolve().parent.parent / "ml_models"
MODEL_PATH = ML_MODELS_DIR / "car_price_pipeline.pkl"
LEGACY_MODEL_PATH = ML_MODELS_DIR / "pricing_model.pkl"
REFERENCE_YEAR = 2026

DEPLOY_INPUT_COLUMNS = [
    "make",
    "model",
    "year",
    "mileage",
    "body_type",
    "transmission",
    "fuel_type",
    "drivetrain",
    "engine_cylinders",
    "engine_volume",
    "color",
]

PIPELINE_FEATURE_NAMES = (
    "Manufacturer",
    "Model",
    "Prod. year",
    "Category",
    "Fuel type",
    "Engine volume",
    "Mileage",
    "Cylinders",
    "Gear box type",
    "Drive wheels",
    "Color",
    "car_age",
    "Engine Displacement",
    "Miles per year",
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
    "Sedan": "Sedan",
    "SUV": "SUV",
    "Coupe": "Coupe",
    "Hatchback": "Hatchback",
    "Pickup": "Pickup",
    "Van": "Van",
    "Wagon": "Wagon",
    "Convertible": "Convertible",
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
    "Gasoline": "Petrol",
    "Gas": "Petrol",
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


class ModelTargetEncoder(BaseEstimator, TransformerMixin):
    """Runtime copy of the custom transformer saved inside car_price_pipeline.pkl."""

    def __init__(self, alpha=10):
        self.alpha = alpha

    def fit(self, X, y):
        X = X.copy()
        y = pd.Series(y, index=X.index, name="Price")
        stats = pd.DataFrame({"Model": X["Model"], "Price": y})

        model_counts = stats.groupby("Model")["Price"].count()
        model_means = stats.groupby("Model")["Price"].mean()
        self.global_mean_ = y.mean()
        self.model_te_ = (
            (model_means * model_counts) + (self.global_mean_ * self.alpha)
        ) / (model_counts + self.alpha)
        return self

    def transform(self, X):
        X = X.copy()
        X["Model_te"] = X["Model"].map(self.model_te_).fillna(self.global_mean_)
        return X[["Model_te"]]


@lru_cache(maxsize=1)
def _load_model():
    model_path = MODEL_PATH if MODEL_PATH.exists() else LEGACY_MODEL_PATH
    if not model_path.exists():
        raise RuntimeError(f"Pricing model not found at {MODEL_PATH} or {LEGACY_MODEL_PATH}.")

    # The notebook saved ModelTargetEncoder from __main__. Registering it here
    # lets joblib unpickle the existing artifact. Future training should move
    # custom transformers into an importable module before dumping the model.
    setattr(sys.modules["__main__"], "ModelTargetEncoder", ModelTargetEncoder)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", InconsistentVersionWarning)
        model = joblib.load(model_path, mmap_mode="r")

    # Prediction does not benefit from using every CPU here, and lower parallelism
    # reduces memory pressure when the forest is very large.
    if hasattr(model, "n_jobs"):
        model.n_jobs = 1
    model_step = getattr(model, "named_steps", {}).get("model")
    if hasattr(model_step, "n_jobs"):
        model_step.n_jobs = 1

    expected_features = tuple(getattr(model, "feature_names_in_", ()))
    if expected_features and expected_features not in (PIPELINE_FEATURE_NAMES, tuple(DEPLOY_INPUT_COLUMNS)):
        raise RuntimeError("Pricing model pipeline inputs do not match the API input map.")
    return model


def _build_model_input(payload: PricePredictionRequest) -> pd.DataFrame:
    make = _normalize_make(payload.make)
    model_name = _canonicalize_model(make, payload.model) or "other"
    color = _normalize_color(payload.color)
    body_type = _normalize_body_type(payload.body_type)
    transmission = _normalize_transmission(payload.transmission)
    drivetrain = _normalize_drivetrain(payload.drivetrain)
    fuel_type = _normalize_fuel_type(payload.fuel_type)
    mileage_value = float(payload.mileage or 0.0)
    car_age = max(0.0, float(REFERENCE_YEAR - payload.year))
    miles_per_year = mileage_value / max(1.0, car_age)
    engine_volume = _normalize_engine_volume(payload.engine_volume)
    cylinders = float(payload.engine_cylinders or 0.0)

    return pd.DataFrame([{
        "Manufacturer": make or "other",
        "Model": model_name,
        "Prod. year": float(payload.year),
        "Category": body_type,
        "Fuel type": fuel_type,
        "Engine volume": engine_volume,
        "Mileage": mileage_value,
        "Cylinders": cylinders,
        "Gear box type": transmission,
        "Drive wheels": drivetrain,
        "Color": color,
        "car_age": car_age,
        "Engine Displacement": engine_volume * cylinders,
        "Miles per year": miles_per_year,
    }], columns=PIPELINE_FEATURE_NAMES)


def _build_deploy_model_input(payload: PricePredictionRequest) -> pd.DataFrame:
    return pd.DataFrame([{
        "make": payload.make,
        "model": payload.model,
        "year": payload.year,
        "mileage": payload.mileage,
        "body_type": payload.body_type,
        "transmission": payload.transmission,
        "fuel_type": payload.fuel_type,
        "drivetrain": payload.drivetrain,
        "engine_cylinders": payload.engine_cylinders,
        "engine_volume": payload.engine_volume,
        "color": payload.color,
    }], columns=DEPLOY_INPUT_COLUMNS)


def generate_price_prediction(payload: PricePredictionRequest) -> int:
    model = _load_model()
    expected_features = tuple(getattr(model, "feature_names_in_", ()))
    model_input = (
        _build_deploy_model_input(payload)
        if expected_features == tuple(DEPLOY_INPUT_COLUMNS)
        else _build_model_input(payload)
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        predicted_price = float(model.predict(model_input)[0])
    if predicted_price <= 0:
        raise RuntimeError("Pricing model returned an invalid prediction.")
    return int(round(predicted_price))
