from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

import nbformat
import pandas as pd
from nbclient import NotebookClient
from sqlalchemy import create_engine, text

from app.core.config import settings
from app.ml_models.pricing_transformers import REFERENCE_YEAR


API_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_PATH = API_ROOT / "app" / "ml_models" / "data" / "app_ready.csv"
DEFAULT_NOTEBOOK_PATH = API_ROOT / "app" / "ml_models" / "notebook" / "car_price_app_ready.ipynb"
DEFAULT_MODEL_PATH = API_ROOT / "app" / "ml_models" / "car_price_pipeline.pkl"

APP_READY_COLUMNS = [
    "price",
    "make",
    "model",
    "year",
    "body_type",
    "fuel_type",
    "engine_volume",
    "mileage",
    "engine_cylinders",
    "transmission",
    "drivetrain",
    "color",
    "car_age",
    "Engine Displacement",
    "Miles per year",
]

MODEL_INPUT_COLUMNS = [
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


def _clean(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def _map_text(value: object, mapping: dict[str, str], default: str = "other") -> str:
    cleaned = _clean(value)
    if not cleaned:
        return default
    return mapping.get(cleaned.lower(), cleaned)


def fetch_training_rows(database_url: str, only_sold: bool) -> pd.DataFrame:
    price_expr = "sold_price" if only_sold else "COALESCE(sold_price, price)"
    query = text(f"""
        SELECT
            {price_expr} AS price,
            make,
            model,
            year,
            body_type,
            fuel_type,
            engine_volume,
            mileage,
            engine_cylinders,
            transmission,
            drivetrain,
            color
        FROM carlisting
        WHERE {price_expr} IS NOT NULL
            AND {price_expr} > 0
            AND make IS NOT NULL
            AND model IS NOT NULL
            AND year IS NOT NULL
    """)
    engine = create_engine(database_url, pool_pre_ping=True)
    with engine.connect() as connection:
        return pd.read_sql(query, connection)


def normalize_training_rows(rows: pd.DataFrame, reference_year: int) -> pd.DataFrame:
    frame = rows.copy()
    for column in APP_READY_COLUMNS:
        if column not in frame.columns:
            frame[column] = None

    frame["price"] = pd.to_numeric(frame["price"], errors="coerce")
    frame["year"] = pd.to_numeric(frame["year"], errors="coerce")
    frame["mileage"] = pd.to_numeric(frame["mileage"], errors="coerce").fillna(0.0)
    frame["engine_volume"] = pd.to_numeric(frame["engine_volume"], errors="coerce").fillna(0.0)
    frame["engine_cylinders"] = pd.to_numeric(frame["engine_cylinders"], errors="coerce").fillna(0.0)

    frame["make"] = frame["make"].map(_clean)
    frame["model"] = frame["model"].map(_clean)
    frame["body_type"] = frame["body_type"].map(lambda value: _map_text(value, BODY_TYPE_MAP))
    frame["fuel_type"] = frame["fuel_type"].map(lambda value: _map_text(value, FUEL_TYPE_MAP))
    frame["transmission"] = frame["transmission"].map(lambda value: _map_text(value, TRANSMISSION_MAP))
    frame["drivetrain"] = frame["drivetrain"].map(lambda value: _map_text(value, DRIVETRAIN_MAP))
    frame["color"] = frame["color"].map(lambda value: _map_text(value, COLOR_MAP))

    frame = frame[
        (frame["price"] > 0)
        & frame["make"].ne("")
        & frame["model"].ne("")
        & frame["year"].notna()
    ].copy()

    frame["car_age"] = (reference_year - frame["year"]).clip(lower=0)
    frame["Engine Displacement"] = frame["engine_volume"] * frame["engine_cylinders"]
    frame["Miles per year"] = frame["mileage"] / frame["car_age"].replace(0, 1)
    return frame[APP_READY_COLUMNS]


def update_dataset(dataset_path: Path, db_rows: pd.DataFrame) -> tuple[int, int]:
    existing = pd.read_csv(dataset_path) if dataset_path.exists() else pd.DataFrame(columns=APP_READY_COLUMNS)
    for column in APP_READY_COLUMNS:
        if column not in existing.columns:
            existing[column] = None

    before_count = len(existing)
    combined = pd.concat([existing[APP_READY_COLUMNS], db_rows], ignore_index=True)
    combined = combined.drop_duplicates().reset_index(drop=True)
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(dataset_path, index=False)
    return before_count, len(combined)


def _path_for_notebook(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(API_ROOT))
    except ValueError:
        return str(path.resolve())


def execute_notebook(
    notebook_path: Path,
    dataset_path: Path,
    model_path: Path,
    executed_notebook_path: Path | None,
) -> None:
    temp_model_path = model_path.with_suffix(model_path.suffix + ".tmp")
    if temp_model_path.exists():
        temp_model_path.unlink()

    previous_training_data = os.environ.get("PRICE_TRAINING_DATA")
    previous_model_output = os.environ.get("PRICE_MODEL_OUTPUT")

    try:
        os.environ["PRICE_TRAINING_DATA"] = _path_for_notebook(dataset_path)
        os.environ["PRICE_MODEL_OUTPUT"] = _path_for_notebook(temp_model_path)

        notebook = nbformat.read(notebook_path, as_version=4)
        client = NotebookClient(
            notebook,
            timeout=None,
            kernel_name="python3",
            resources={"metadata": {"path": str(API_ROOT)}},
        )
        client.execute()

        if not temp_model_path.exists():
            raise RuntimeError(f"Notebook completed but did not create {temp_model_path}.")

        model_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(temp_model_path), model_path)

        if executed_notebook_path:
            nbformat.write(notebook, executed_notebook_path)
    except Exception:
        if temp_model_path.exists():
            temp_model_path.unlink()
        raise
    finally:
        if previous_training_data is None:
            os.environ.pop("PRICE_TRAINING_DATA", None)
        else:
            os.environ["PRICE_TRAINING_DATA"] = previous_training_data

        if previous_model_output is None:
            os.environ.pop("PRICE_MODEL_OUTPUT", None)
        else:
            os.environ["PRICE_MODEL_OUTPUT"] = previous_model_output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Append DB listings to app_ready.csv and retrain the pricing model.")
    parser.add_argument("--database-url", default=settings.DATABASE_URL)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET_PATH)
    parser.add_argument("--notebook", type=Path, default=DEFAULT_NOTEBOOK_PATH)
    parser.add_argument("--model-output", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--executed-notebook", type=Path, default=None)
    parser.add_argument("--only-sold", action="store_true", help="Train only from listings with sold_price.")
    parser.add_argument("--skip-notebook", action="store_true", help="Only update app_ready.csv.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    db_rows = normalize_training_rows(
        fetch_training_rows(args.database_url, args.only_sold),
        reference_year=REFERENCE_YEAR,
    )
    before_count, after_count = update_dataset(args.dataset, db_rows)
    print(f"Fetched {len(db_rows)} DB rows.")
    print(f"Updated {args.dataset}: {before_count} -> {after_count} rows.")

    if args.skip_notebook:
        return

    execute_notebook(args.notebook, args.dataset, args.model_output, args.executed_notebook)
    print(f"Saved retrained model to {args.model_output}.")


if __name__ == "__main__":
    main()
