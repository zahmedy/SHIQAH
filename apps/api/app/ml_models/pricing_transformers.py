from __future__ import annotations

import re

import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


REFERENCE_YEAR = 2026

SUPPORTED_MAKES = [
    "Toyota", "Hyundai", "Nissan", "Kia", "Honda", "Lexus", "GMC",
    "Chevrolet", "Ford", "Tesla", "BMW", "Mercedes-Benz", "Mitsubishi",
    "Land Rover", "Jeep", "Dodge", "Ram", "Volkswagen", "Audi", "Mazda",
    "Infiniti", "Cadillac", "Subaru",
]

SUPPORTED_MODELS = [
    "Camry", "Corolla", "RAV4", "Highlander", "4Runner", "Tacoma", "Tundra",
    "Prius", "Prius C", "Prius V", "Sienna", "Sequoia", "Land Cruiser",
    "Land Cruiser Prado", "Crown", "Avalon", "C-HR", "Aqua", "Vitz", "Ist", "VOXY",
    "Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Venue",
    "Santa Cruz", "Ioniq 5", "Ioniq 6", "Accent", "Genesis", "Grandeur", "Veloster", "i30", "H1",
    "Altima", "Sentra", "Versa", "Rogue", "Murano", "Pathfinder", "Armada",
    "Frontier", "Leaf", "Kicks", "Z", "Juke", "Tiida", "Note", "March", "X-Trail", "Xterra", "Serena", "Skyline",
    "K4", "K5", "Forte", "Soul", "Seltos", "Sportage", "Sorento", "Telluride", "Carnival", "EV6", "EV9", "Optima", "Rio", "Picanto", "Cerato",
    "Accord", "Civic", "CR-V", "HR-V", "Pilot", "Odyssey", "Passport", "Ridgeline", "Prologue", "Fit", "Insight", "Elysion",
    "RX 350", "RX 450", "NX 350", "ES 350", "ES 300", "GX 550", "GX 460", "GX 470",
    "LX 600", "LS 500", "LS 460", "IS 350", "IS 250", "RC 350", "TX 350", "UX 300h", "CT 200h", "HS 250h",
    "Terrain", "Acadia", "Yukon", "Yukon XL", "Canyon", "Sierra 1500", "Sierra HD", "Hummer EV",
    "Trax", "Trailblazer", "Equinox", "Blazer", "Traverse", "Tahoe", "Suburban", "Colorado", "Silverado 1500",
    "Malibu", "Corvette", "Cruze", "Captiva", "Volt", "Orlando", "Spark", "Aveo", "Impala", "Camaro",
    "Maverick", "Ranger", "F-150", "Mustang", "Escape", "Bronco Sport", "Bronco", "Explorer", "Expedition",
    "Transit", "Fusion", "Focus", "Fiesta", "Taurus", "Transit Connect",
    "Model 3", "Model Y", "Model S", "Model X", "Cybertruck",
    "2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X6", "X7", "i4", "iX",
    "C-Class", "E-Class", "S-Class", "CLA", "CLS", "GLA", "GLC", "GLE", "GLS", "GL", "ML", "EQB", "EQE", "G-Class", "Sprinter", "Vito",
    "Mirage", "Outlander", "Outlander Sport", "Eclipse Cross", "Pajero", "Pajero iO", "Airtrek", "Colt",
    "Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque", "Discovery", "Defender",
    "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator", "Wagoneer", "Grand Wagoneer",
    "Hornet", "Durango", "Charger", "Challenger", "Caliber",
    "1500", "2500", "3500", "ProMaster",
    "Jetta", "Taos", "Tiguan", "Atlas", "Atlas Cross Sport", "Golf GTI", "Golf R", "Golf", "ID.4", "Passat", "CC",
    "A3", "A4", "A5", "A6", "A7", "Q3", "Q5", "Q7", "Q8", "e-tron", "Q4 e-tron",
    "Mazda3", "Mazda6", "CX-30", "CX-5", "CX-9", "CX-50", "CX-70", "CX-90", "MX-5 Miata", "MPV", "Demio",
    "Q50", "QX50", "QX55", "QX60", "QX80",
    "CT4", "CT5", "XT4", "XT5", "XT6", "Escalade", "Lyriq", "Optiq",
    "Impreza", "Legacy", "WRX", "Crosstrek", "Forester", "Outback", "Ascent", "BRZ", "Solterra", "XV",
]

MODEL_ALIASES = {
    "rav4": "RAV4", "rav 4": "RAV4", "chr": "C-HR",
    "camryse": "Camry", "camryxle": "Camry",
    "priusc": "Prius C", "priusv": "Prius V", "landcruiserprado": "Land Cruiser Prado",
    "h1": "H1", "i30": "i30",
    "xtrail": "X-Trail", "xterra": "Xterra", "xterraa": "Xterra",
    "gx460": "GX 460", "gx470": "GX 470", "rx450": "RX 450",
    "es300": "ES 300", "ls460": "LS 460", "is250": "IS 250",
    "ct200h": "CT 200h", "hs250h": "HS 250h",
    "cruzelt": "Cruze", "silverado1500": "Silverado 1500",
    "f150": "F-150", "transitconnect": "Transit Connect",
    "model3": "Model 3", "modely": "Model Y", "models": "Model S", "modelx": "Model X",
    "328": "3 Series", "320": "3 Series", "318": "3 Series", "330": "3 Series", "335": "3 Series",
    "525": "5 Series", "528": "5 Series", "530": "5 Series", "535": "5 Series", "550": "5 Series",
    "c300": "C-Class", "c250": "C-Class", "c200": "C-Class", "c180": "C-Class",
    "e350": "E-Class", "e300": "E-Class", "e320": "E-Class", "e200": "E-Class",
    "s550": "S-Class", "gla250": "GLA", "gle350": "GLE", "gl450": "GL", "ml350": "ML",
    "cla250": "CLA", "cls550": "CLS",
    "pajeroio": "Pajero iO",
    "golfgti": "Golf GTI", "golfr": "Golf R",
    "mazda6": "Mazda6", "cx9": "CX-9", "xv": "XV",
}


def _normalize_text(value: object) -> str:
    text = str(value).strip().lower()
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"[^a-z0-9\s\-]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _make_model_key(value: object) -> str:
    return _normalize_text(value).replace("-", "").replace(" ", "")


class MakeCanonicalizer(BaseEstimator, TransformerMixin):
    def __init__(self, min_count=30):
        self.min_count = min_count

    def fit(self, X, y=None):
        frame = X.copy()
        frame["make"] = self._canonicalize_make(frame["make"])
        make_counts = frame["make"].value_counts()
        self.rare_makes_ = set(make_counts[make_counts < self.min_count].index)
        return self

    def transform(self, X):
        frame = X.copy()
        frame["make"] = self._canonicalize_make(frame["make"])
        frame.loc[frame["make"].isin(self.rare_makes_), "make"] = "other"
        return frame

    def _canonicalize_make(self, make_series):
        make_lookup = {make.lower(): make for make in SUPPORTED_MAKES}
        normalized = make_series.astype("string").str.strip().str.lower().map(make_lookup)
        return normalized.fillna("other")


class FilteringFeatureEngineering(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        return self

    def transform(self, X):
        frame = X.copy()
        frame["year"] = pd.to_numeric(frame["year"], errors="coerce").fillna(REFERENCE_YEAR)
        frame["engine_volume"] = pd.to_numeric(frame["engine_volume"], errors="coerce").fillna(0.0)
        frame["engine_cylinders"] = pd.to_numeric(frame["engine_cylinders"], errors="coerce").fillna(0.0)
        frame["mileage"] = pd.to_numeric(frame["mileage"], errors="coerce").fillna(0.0)

        frame["car_age"] = (REFERENCE_YEAR - frame["year"]).clip(lower=0)
        frame["engine_displacement"] = frame["engine_volume"] * frame["engine_cylinders"]
        frame["miles_per_year"] = frame["mileage"] / frame["car_age"].replace(0, 1)
        return frame


class ModelCanonicalizer(BaseEstimator, TransformerMixin):
    def __init__(self, min_count=10):
        self.min_count = min_count

    def fit(self, X, y=None):
        self.rare_models_ = set()
        frame = self.transform(X)
        model_counts = frame["model"].value_counts()
        self.rare_models_ = set(model_counts[model_counts < self.min_count].index)
        return self

    def transform(self, X):
        frame = X.copy()
        self.model_lookup_ = {_make_model_key(model): model for model in SUPPORTED_MODELS}
        self.model_aliases_ = MODEL_ALIASES
        frame["model"] = frame["model"].apply(self._canonicalize_model)
        frame.loc[frame["model"].isin(self.rare_models_), "model"] = "other"
        return frame

    def _canonicalize_model(self, raw_model):
        if pd.isna(raw_model):
            return "other"

        raw_key = _make_model_key(raw_model)
        if raw_key in self.model_aliases_:
            return self.model_aliases_[raw_key]

        if raw_key in self.model_lookup_:
            return self.model_lookup_[raw_key]

        for model_key, canonical_model in sorted(self.model_lookup_.items(), key=lambda item: len(item[0]), reverse=True):
            if raw_key.startswith(model_key):
                return canonical_model

        return "other"


class ModelTargetEncoder(BaseEstimator, TransformerMixin):
    def __init__(self, alpha=10):
        self.alpha = alpha

    def fit(self, X, y=None):
        frame = X.copy()
        frame["price"] = pd.Series(y, index=frame.index)

        model_count = frame.groupby("model")["price"].count()
        model_means = frame.groupby("model")["price"].mean()
        self.global_mean_ = frame["price"].mean()
        self.model_te_ = (
            model_means * model_count + self.global_mean_ * self.alpha
        ) / (model_count + self.alpha)
        return self

    def transform(self, X):
        frame = X.copy()
        frame["model_te"] = frame["model"].map(self.model_te_).fillna(self.global_mean_)
        return frame.drop(columns=["model"])
