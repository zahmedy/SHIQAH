from __future__ import annotations

import re
from typing import Any

import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


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

CANONICAL_FEATURE_COLUMNS = [
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
]

NUMERIC_FEATURES = [
    "Prod. year",
    "Engine volume",
    "Mileage",
    "Cylinders",
    "car_age",
    "Engine Displacement",
    "Miles per year",
]

CATEGORICAL_FEATURES = [
    "Manufacturer",
    "Color",
    "Category",
    "Fuel type",
    "Drive wheels",
    "Gear box type",
]

COLOR_MAP = {
    "silver": "Silver",
    "black": "Black",
    "white": "White",
    "grey": "Gray",
    "gray": "Gray",
    "blue": "Blue",
    "sky blue": "Blue",
    "green": "Green",
    "red": "Red",
    "carnelian red": "Red",
    "orange": "Orange",
    "yellow": "Gold",
    "brown": "Brown",
    "golden": "Gold",
    "gold": "Gold",
    "beige": "Beige",
    "purple": "Purple",
    "pink": "Red",
}

BODY_TYPE_MAP = {
    "sedan": "Sedan",
    "suv": "SUV",
    "jeep": "SUV",
    "coupe": "Coupe",
    "hatchback": "Hatchback",
    "pickup": "Pickup",
    "van": "Van",
    "minivan": "Van",
    "microbus": "Van",
    "goods wagon": "Van",
    "wagon": "Wagon",
    "universal": "Wagon",
    "convertible": "Convertible",
    "cabriolet": "Convertible",
    "limousine": "Sedan",
}

TRANSMISSION_MAP = {
    "automatic": "Automatic",
    "tiptronic": "Automatic",
    "variator": "Automatic",
    "manual": "Manual",
}

FUEL_TYPE_MAP = {
    "hybrid": "Hybrid",
    "plug-in hybrid": "Hybrid",
    "petrol": "Petrol",
    "gas": "Petrol",
    "gasoline": "Petrol",
    "cng": "Petrol",
    "lpg": "Petrol",
    "diesel": "Diesel",
    "electric": "Electric",
    "hydrogen": "Electric",
}

DRIVETRAIN_MAP = {
    "4x4": "AWD",
    "4wd": "AWD",
    "awd": "AWD",
    "front": "FWD",
    "fwd": "FWD",
    "rear": "RWD",
    "rwd": "RWD",
}

SUPPORTED_MAKES = [
    "Toyota", "Hyundai", "Nissan", "Kia", "Honda", "Lexus", "GMC",
    "Chevrolet", "Ford", "Tesla", "BMW", "Mercedes-Benz", "Mitsubishi",
    "Land Rover", "Jeep", "Dodge", "Ram", "Volkswagen", "Audi", "Mazda",
    "Infiniti", "Cadillac", "Subaru",
]

MAKE_LOOKUP = {make.lower(): make for make in SUPPORTED_MAKES}

MODEL_ALIASES = {
    "rav4": "RAV4",
    "rav 4": "RAV4",
    "chr": "C-HR",
    "landcruiserprado": "Land Cruiser Prado",
    "xtrail": "X-Trail",
    "f150": "F-150",
    "transitconnect": "Transit Connect",
    "model3": "Model 3",
    "modely": "Model Y",
    "models": "Model S",
    "modelx": "Model X",
    "cx9": "CX-9",
    "mazda6": "Mazda6",
    "golfgti": "Golf GTI",
    "golfr": "Golf R",
}


def _clean_text(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    next_value = str(value).strip()
    next_value = next_value.replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", next_value).strip()


def _lookup(mapping: dict[str, str], value: Any, default: str | None = None) -> str | None:
    text = _clean_text(value).lower()
    if not text:
        return default
    return mapping.get(text, default if default is not None else _clean_text(value))


def _model_key(value: Any) -> str:
    text = _clean_text(value).lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    return text.replace("-", "").replace(" ", "")


def canonicalize_make(value: Any) -> str:
    text = _clean_text(value)
    if not text:
        return "other"
    return MAKE_LOOKUP.get(text.lower(), text.title())


def canonicalize_model(value: Any) -> str:
    text = _clean_text(value)
    if not text:
        return "other"
    return MODEL_ALIASES.get(_model_key(text), text)


def to_numeric_series(series: pd.Series, default: float = 0.0) -> pd.Series:
    cleaned = series.astype("string").str.replace(r"[^0-9.]", "", regex=True)
    return pd.to_numeric(cleaned, errors="coerce").fillna(default)


class AutoIntelPricingPreprocessor(BaseEstimator, TransformerMixin):
    """Convert app-shaped raw listing fields into model-ready canonical columns."""

    def __init__(self, reference_year: int = 2026):
        self.reference_year = reference_year

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        frame = pd.DataFrame(X).copy()
        for column in DEPLOY_INPUT_COLUMNS:
            if column not in frame.columns:
                frame[column] = None

        year = to_numeric_series(frame["year"], default=float(self.reference_year))
        mileage = to_numeric_series(frame["mileage"], default=0.0)
        engine_volume = to_numeric_series(frame["engine_volume"], default=0.0)
        cylinders = to_numeric_series(frame["engine_cylinders"], default=0.0)
        car_age = (float(self.reference_year) - year).clip(lower=0.0)

        output = pd.DataFrame(index=frame.index)
        output["Manufacturer"] = frame["make"].map(canonicalize_make)
        output["Model"] = frame["model"].map(canonicalize_model)
        output["Prod. year"] = year.astype(float)
        output["Category"] = frame["body_type"].map(lambda value: _lookup(BODY_TYPE_MAP, value, "other"))
        output["Fuel type"] = frame["fuel_type"].map(lambda value: _lookup(FUEL_TYPE_MAP, value, "other"))
        output["Engine volume"] = engine_volume.astype(float)
        output["Mileage"] = mileage.astype(float)
        output["Cylinders"] = cylinders.astype(float)
        output["Gear box type"] = frame["transmission"].map(lambda value: _lookup(TRANSMISSION_MAP, value, "other"))
        output["Drive wheels"] = frame["drivetrain"].map(lambda value: _lookup(DRIVETRAIN_MAP, value, "other"))
        output["Color"] = frame["color"].map(lambda value: _lookup(COLOR_MAP, value, "other"))
        output["car_age"] = car_age.astype(float)
        output["Engine Displacement"] = output["Engine volume"] * output["Cylinders"]
        output["Miles per year"] = output["Mileage"] / output["car_age"].clip(lower=1.0)
        return output[CANONICAL_FEATURE_COLUMNS]


class ModelTargetEncoder(BaseEstimator, TransformerMixin):
    """Smoothed target encoder for model name, safe for unknown models."""

    def __init__(self, alpha: float = 10.0):
        self.alpha = alpha

    def fit(self, X, y):
        frame = pd.DataFrame(X).copy()
        model_column = frame.iloc[:, 0].astype("string").fillna("other")
        target = pd.Series(y, index=frame.index, name="price")
        stats = pd.DataFrame({"Model": model_column, "price": target})
        counts = stats.groupby("Model")["price"].count()
        means = stats.groupby("Model")["price"].mean()
        self.global_mean_ = float(target.mean())
        self.model_te_ = ((means * counts) + (self.global_mean_ * self.alpha)) / (counts + self.alpha)
        return self

    def transform(self, X):
        frame = pd.DataFrame(X).copy()
        model_column = frame.iloc[:, 0].astype("string").fillna("other")
        encoded = model_column.map(self.model_te_).fillna(self.global_mean_)
        return pd.DataFrame({"Model_te": encoded.astype(float)}, index=frame.index)


def build_pricing_pipeline(random_state: int = 42, n_estimators: int = 1000, n_jobs: int = -1) -> Pipeline:
    model_features = ["Model"]
    preprocessor = ColumnTransformer(
        transformers=[
            ("model_te", ModelTargetEncoder(alpha=10.0), model_features),
            ("num", SimpleImputer(strategy="median"), NUMERIC_FEATURES),
            (
                "cat",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                ]),
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )

    return Pipeline([
        ("pricing_preprocessor", AutoIntelPricingPreprocessor()),
        ("feature_preprocessor", preprocessor),
        ("model", ExtraTreesRegressor(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
            min_samples_leaf=2,
        )),
    ])
