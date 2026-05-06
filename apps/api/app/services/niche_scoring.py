from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


DEFAULT_NICHE_ID = "cold_weather_commuter"
BUDGET_DAILY_NICHE_ID = "budget_daily_driver"

LOW_MILEAGE_MILES = 100_000
DAILY_MILEAGE_MILES = 120_000
LOW_MILEAGE_KM = LOW_MILEAGE_MILES * 1.60934
DAILY_MILEAGE_KM = DAILY_MILEAGE_MILES * 1.60934

NicheScoreConfidence = Literal["low", "medium", "high"]
NicheScoreLabel = str


@dataclass(frozen=True)
class ScoreSignal:
    weight: float
    value: float
    reason: str | None = None
    warning: str | None = None
    missing: str | None = None


def _get(listing: Any, field: str) -> Any:
    if isinstance(listing, dict):
        return listing.get(field)
    return getattr(listing, field, None)


def _normalized(value: Any) -> str:
    return str(value or "").strip().lower()


def _has_value(value: Any) -> bool:
    return value is not None and str(value).strip() != ""


def _format_miles(kilometers: float) -> str:
    miles = round(kilometers * 0.621371)
    return f"{miles:,} mi"


def _display_value(value: Any) -> str:
    return str(value or "").strip()


def _positive_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _listing_text(listing: Any) -> str:
    return _normalized(f"{_get(listing, 'title')} {_get(listing, 'description')}")


def _mentions_winter_readiness(listing: Any) -> bool:
    text = _listing_text(listing)
    return any(
        term in text
        for term in (
            "snow tire",
            "winter tire",
            "heated seat",
            "garage",
            "rust",
            "battery warranty",
            "remote start",
            "إطارات شتوية",
            "كفرات شتوية",
            "تدفئة",
            "مقاعد مدفأة",
            "قراج",
            "كراج",
            "صدأ",
            "بطارية",
            "تشغيل عن بعد",
        )
    )


def _mentions_clean_ownership_signal(listing: Any) -> bool:
    text = _listing_text(listing)
    return any(
        term in text
        for term in (
            "service record",
            "maintenance",
            "one owner",
            "clean title",
            "no accident",
            "new tires",
            "recent tires",
            "سجل صيانة",
            "صيانة",
            "مالك واحد",
            "استخدام شخصي",
            "بدون حوادث",
            "ماشي قليل",
            "كفرات جديدة",
            "إطارات جديدة",
        )
    )


def _confidence_from_signals(signals: list[ScoreSignal]) -> NicheScoreConfidence:
    total_weight = sum(signal.weight for signal in signals)
    observed_weight = sum(signal.weight for signal in signals if not signal.missing)
    coverage = observed_weight / total_weight if total_weight else 0
    if coverage >= 0.78:
        return "high"
    if coverage >= 0.52:
        return "medium"
    return "low"


def _label_for_score(score: int, fit_name: str) -> NicheScoreLabel:
    if score >= 80:
        return f"Strong {fit_name} fit"
    if score >= 62:
        return f"Good {fit_name} fit"
    if score >= 42:
        return f"Basic {fit_name} fit"
    return f"Weak {fit_name} fit"


def _finalize_score(signals: list[ScoreSignal], fit_name: str) -> dict[str, Any]:
    total_weight = sum(signal.weight for signal in signals)
    raw_score = sum(signal.weight * signal.value for signal in signals)
    score = round(max(0, min(1, raw_score / total_weight if total_weight else 0)) * 100)
    return {
        "score": score,
        "confidence": _confidence_from_signals(signals),
        "label": _label_for_score(score, fit_name),
        "reasons": _unique_compact_tags(
            signal.reason
            for signal in sorted(signals, key=lambda item: item.weight * item.value, reverse=True)
            if signal.reason
        ),
        "warnings": _unique_compact_tags(
            signal.warning
            for signal in sorted(signals, key=lambda item: item.weight, reverse=True)
            if signal.warning
        ),
        "missing_signals": [
            signal.missing
            for signal in sorted(signals, key=lambda item: item.weight, reverse=True)
            if signal.missing
        ],
    }


def _unique_compact_tags(values: Any) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()
    for value in values:
        tag = str(value or "").strip()
        if not tag or len(tag) > 42:
            continue
        key = tag.casefold()
        if key in seen:
            continue
        seen.add(key)
        tags.append(tag)
    return tags


def _cold_weather_scorecard(listing: Any) -> dict[str, Any]:
    drivetrain = _normalized(_get(listing, "drivetrain"))
    body_type = _normalized(_get(listing, "body_type"))
    fuel_type = _normalized(_get(listing, "fuel_type"))
    mileage = _get(listing, "mileage")
    signals: list[ScoreSignal] = []

    if not _has_value(_get(listing, "drivetrain")):
        signals.append(ScoreSignal(weight=34, value=0, missing="Drivetrain not listed"))
    elif drivetrain in {"awd", "4wd"}:
        signals.append(ScoreSignal(weight=34, value=1, reason=f"{_display_value(_get(listing, 'drivetrain'))} traction"))
    elif drivetrain == "fwd":
        signals.append(ScoreSignal(weight=34, value=0.45, reason="FWD"))
    else:
        signals.append(ScoreSignal(weight=34, value=-0.35, warning="RWD winter caution"))

    if not _has_value(_get(listing, "body_type")):
        signals.append(ScoreSignal(weight=18, value=0, missing="Body style not listed"))
    elif body_type in {"suv", "wagon", "pickup"}:
        signals.append(ScoreSignal(weight=18, value=1, reason=_display_value(_get(listing, "body_type"))))
    elif body_type in {"hatchback", "sedan"}:
        signals.append(ScoreSignal(weight=18, value=0.65, reason=_display_value(_get(listing, "body_type"))))
    elif body_type == "convertible":
        signals.append(ScoreSignal(weight=18, value=-0.4, warning="Convertible"))
    else:
        signals.append(ScoreSignal(weight=18, value=0.25))

    if mileage is None:
        signals.append(ScoreSignal(weight=18, value=0, missing="Mileage not listed"))
    elif mileage <= LOW_MILEAGE_KM:
        signals.append(ScoreSignal(weight=18, value=1, reason=f"Under {_format_miles(LOW_MILEAGE_KM)}"))
    elif mileage <= LOW_MILEAGE_KM * 1.35:
        signals.append(ScoreSignal(weight=18, value=0.45))
    else:
        signals.append(ScoreSignal(weight=18, value=-0.25, warning="High mileage"))

    if _mentions_winter_readiness(listing):
        signals.append(ScoreSignal(weight=18, value=1, reason="Winter details"))
    else:
        signals.append(ScoreSignal(weight=18, value=0, missing="No winter tire, rust, garage, battery, or remote-start note"))

    if not _has_value(_get(listing, "fuel_type")):
        signals.append(ScoreSignal(weight=12, value=0, missing="Fuel type not listed"))
    elif fuel_type in {"hybrid", "petrol", "gasoline"}:
        signals.append(ScoreSignal(weight=12, value=0.9, reason="Hybrid" if fuel_type == "hybrid" else None))
    elif fuel_type == "diesel":
        signals.append(ScoreSignal(weight=12, value=0.45, warning="Diesel cold-start check"))
    elif fuel_type == "electric":
        signals.append(ScoreSignal(weight=12, value=0.55, warning="EV winter range check"))
    else:
        signals.append(ScoreSignal(weight=12, value=0.2))

    return _finalize_score(signals, "winter")


def _budget_daily_scorecard(listing: Any) -> dict[str, Any]:
    fuel_type = _normalized(_get(listing, "fuel_type"))
    body_type = _normalized(_get(listing, "body_type"))
    condition = _normalized(_get(listing, "condition"))
    cylinders = _positive_int(_get(listing, "engine_cylinders"))
    mileage = _get(listing, "mileage")
    signals: list[ScoreSignal] = []

    if mileage is None:
        signals.append(ScoreSignal(weight=22, value=0, missing="Mileage not listed"))
    elif mileage <= DAILY_MILEAGE_KM:
        signals.append(ScoreSignal(weight=22, value=1, reason=f"Under {_format_miles(DAILY_MILEAGE_KM)}"))
    elif mileage <= DAILY_MILEAGE_KM * 1.25:
        signals.append(ScoreSignal(weight=22, value=0.45))
    else:
        signals.append(ScoreSignal(weight=22, value=-0.25, warning="High mileage"))

    if not _has_value(_get(listing, "body_type")):
        signals.append(ScoreSignal(weight=14, value=0, missing="Body style not listed"))
    elif body_type in {"sedan", "hatchback", "wagon"}:
        signals.append(ScoreSignal(weight=14, value=1, reason=_display_value(_get(listing, "body_type"))))
    elif body_type in {"suv", "van"}:
        signals.append(ScoreSignal(weight=14, value=0.55, reason=_display_value(_get(listing, "body_type"))))
    elif body_type == "pickup":
        signals.append(ScoreSignal(weight=14, value=0.25, warning="Pickup efficiency check"))
    else:
        signals.append(ScoreSignal(weight=14, value=0.15))

    if not _has_value(_get(listing, "fuel_type")):
        signals.append(ScoreSignal(weight=18, value=0, missing="Fuel type not listed"))
    elif fuel_type == "hybrid":
        signals.append(ScoreSignal(weight=18, value=1, reason="Hybrid"))
    elif fuel_type in {"petrol", "gasoline"}:
        signals.append(ScoreSignal(weight=18, value=0.65))
    elif fuel_type == "electric":
        signals.append(ScoreSignal(weight=18, value=0.65, reason="Electric"))
    elif fuel_type == "diesel":
        signals.append(ScoreSignal(weight=18, value=0.35, warning="Diesel short-trip check"))
    else:
        signals.append(ScoreSignal(weight=18, value=0.2))

    if not _has_value(_get(listing, "condition")):
        signals.append(ScoreSignal(weight=10, value=0, missing="Condition not listed"))
    elif condition == "used":
        signals.append(ScoreSignal(weight=10, value=0.85))
    elif condition == "new":
        signals.append(ScoreSignal(weight=10, value=0.55))
    else:
        signals.append(ScoreSignal(weight=10, value=0.35))

    if cylinders is None:
        signals.append(ScoreSignal(weight=30, value=0, missing="Cylinders not listed"))
    elif cylinders <= 4:
        signals.append(ScoreSignal(weight=30, value=1, reason="4-cylinder efficiency"))
    elif cylinders == 6:
        signals.append(ScoreSignal(weight=30, value=0.35, warning="6-cylinder fuel cost"))
    elif cylinders >= 8:
        signals.append(ScoreSignal(weight=30, value=-0.65, warning=f"{cylinders}-cylinder fuel cost"))
    else:
        signals.append(ScoreSignal(weight=30, value=0.15, warning="Fuel economy check"))

    if _mentions_clean_ownership_signal(listing):
        signals.append(ScoreSignal(weight=6, value=1, reason="Service / ownership details"))
    else:
        signals.append(ScoreSignal(weight=6, value=0, missing="No maintenance, title, ownership, or tire-care note"))

    return _finalize_score(signals, "budget")


def score_listing_for_niche(listing: Any, niche_id: str | None) -> dict[str, Any]:
    if niche_id == BUDGET_DAILY_NICHE_ID:
        return _budget_daily_scorecard(listing)
    return _cold_weather_scorecard(listing)


def score_listing_for_all_niches(listing: Any) -> dict[str, dict[str, Any]]:
    return {
        DEFAULT_NICHE_ID: _cold_weather_scorecard(listing),
        BUDGET_DAILY_NICHE_ID: _budget_daily_scorecard(listing),
    }
