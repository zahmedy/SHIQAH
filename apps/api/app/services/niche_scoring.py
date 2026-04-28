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
NicheScoreLabel = Literal["Strong niche fit", "Good niche fit", "Basic niche fit", "Weak niche fit"]


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


def _listing_text(listing: Any) -> str:
    return _normalized(f"{_get(listing, 'title_ar')} {_get(listing, 'description_ar')}")


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


def _label_for_score(score: int) -> NicheScoreLabel:
    if score >= 80:
        return "Strong niche fit"
    if score >= 62:
        return "Good niche fit"
    if score >= 42:
        return "Basic niche fit"
    return "Weak niche fit"


def _finalize_score(signals: list[ScoreSignal]) -> dict[str, Any]:
    total_weight = sum(signal.weight for signal in signals)
    raw_score = sum(signal.weight * signal.value for signal in signals)
    score = round(max(0, min(1, raw_score / total_weight if total_weight else 0)) * 100)
    return {
        "score": score,
        "confidence": _confidence_from_signals(signals),
        "label": _label_for_score(score),
        "reasons": [
            signal.reason
            for signal in sorted(signals, key=lambda item: item.weight * item.value, reverse=True)
            if signal.reason
        ],
        "warnings": [
            signal.warning
            for signal in sorted(signals, key=lambda item: item.weight, reverse=True)
            if signal.warning
        ],
        "missing_signals": [
            signal.missing
            for signal in sorted(signals, key=lambda item: item.weight, reverse=True)
            if signal.missing
        ],
    }


def _cold_weather_scorecard(listing: Any) -> dict[str, Any]:
    drivetrain = _normalized(_get(listing, "drivetrain"))
    body_type = _normalized(_get(listing, "body_type"))
    fuel_type = _normalized(_get(listing, "fuel_type"))
    mileage = _get(listing, "mileage")
    signals: list[ScoreSignal] = []

    if not _has_value(_get(listing, "drivetrain")):
        signals.append(ScoreSignal(weight=34, value=0, missing="Drivetrain not listed"))
    elif drivetrain in {"awd", "4wd"}:
        signals.append(ScoreSignal(weight=34, value=1, reason=f"{_get(listing, 'drivetrain')} traction"))
    elif drivetrain == "fwd":
        signals.append(ScoreSignal(weight=34, value=0.45, reason="FWD is manageable in winter with proper tires"))
    else:
        signals.append(ScoreSignal(weight=34, value=-0.35, warning="RWD is a weaker fit for winter commuting"))

    if not _has_value(_get(listing, "body_type")):
        signals.append(ScoreSignal(weight=18, value=0, missing="Body style not listed"))
    elif body_type in {"suv", "wagon", "pickup"}:
        signals.append(ScoreSignal(weight=18, value=1, reason=f"{_get(listing, 'body_type')} body suits rough-weather utility"))
    elif body_type in {"hatchback", "sedan"}:
        signals.append(ScoreSignal(weight=18, value=0.65, reason=f"{_get(listing, 'body_type')} body is usable for commuting"))
    elif body_type == "convertible":
        signals.append(ScoreSignal(weight=18, value=-0.4, warning="Convertible body is a poor cold-weather fit"))
    else:
        signals.append(ScoreSignal(weight=18, value=0.25, warning=f"{_get(listing, 'body_type')} body has limited winter-utility signal"))

    if mileage is None:
        signals.append(ScoreSignal(weight=18, value=0, missing="Mileage not listed"))
    elif mileage <= LOW_MILEAGE_KM:
        signals.append(ScoreSignal(weight=18, value=1, reason=f"Under {_format_miles(LOW_MILEAGE_KM)}"))
    elif mileage <= LOW_MILEAGE_KM * 1.35:
        signals.append(ScoreSignal(weight=18, value=0.45, reason="Moderate mileage for winter use"))
    else:
        signals.append(ScoreSignal(weight=18, value=-0.25, warning="High mileage weakens cold-weather confidence"))

    if _mentions_winter_readiness(listing):
        signals.append(ScoreSignal(weight=18, value=1, reason="Seller notes mention winter-relevant equipment or care"))
    else:
        signals.append(ScoreSignal(weight=18, value=0, missing="No winter tire, rust, garage, battery, or remote-start note"))

    if not _has_value(_get(listing, "fuel_type")):
        signals.append(ScoreSignal(weight=12, value=0, missing="Fuel type not listed"))
    elif fuel_type in {"hybrid", "petrol", "gasoline"}:
        signals.append(ScoreSignal(weight=12, value=0.9, reason=f"{_get(listing, 'fuel_type')} powertrain fits routine commuting"))
    elif fuel_type == "diesel":
        signals.append(ScoreSignal(weight=12, value=0.45, warning="Diesel can need more cold-start context"))
    elif fuel_type == "electric":
        signals.append(ScoreSignal(weight=12, value=0.55, warning="EV range and charging access matter more in cold weather"))
    else:
        signals.append(ScoreSignal(weight=12, value=0.2, warning="Fuel type has limited cold-weather signal"))

    return _finalize_score(signals)


def _budget_daily_scorecard(listing: Any) -> dict[str, Any]:
    fuel_type = _normalized(_get(listing, "fuel_type"))
    body_type = _normalized(_get(listing, "body_type"))
    condition = _normalized(_get(listing, "condition"))
    mileage = _get(listing, "mileage")
    signals: list[ScoreSignal] = []

    if mileage is None:
        signals.append(ScoreSignal(weight=26, value=0, missing="Mileage not listed"))
    elif mileage <= DAILY_MILEAGE_KM:
        signals.append(ScoreSignal(weight=26, value=1, reason=f"Under {_format_miles(DAILY_MILEAGE_KM)}"))
    elif mileage <= DAILY_MILEAGE_KM * 1.25:
        signals.append(ScoreSignal(weight=26, value=0.45, reason="Mileage is still workable for daily use"))
    else:
        signals.append(ScoreSignal(weight=26, value=-0.25, warning="High mileage weakens daily-driver confidence"))

    if not _has_value(_get(listing, "body_type")):
        signals.append(ScoreSignal(weight=24, value=0, missing="Body style not listed"))
    elif body_type in {"sedan", "hatchback", "wagon"}:
        signals.append(ScoreSignal(weight=24, value=1, reason=f"{_get(listing, 'body_type')} body is easy to live with daily"))
    elif body_type in {"suv", "van"}:
        signals.append(ScoreSignal(weight=24, value=0.55, reason=f"{_get(listing, 'body_type')} body can work as a daily driver"))
    elif body_type == "pickup":
        signals.append(ScoreSignal(weight=24, value=0.25, warning="Pickup body may be less efficient for daily errands"))
    else:
        signals.append(ScoreSignal(weight=24, value=0.15, warning=f"{_get(listing, 'body_type')} body is less typical for budget daily use"))

    if not _has_value(_get(listing, "fuel_type")):
        signals.append(ScoreSignal(weight=22, value=0, missing="Fuel type not listed"))
    elif fuel_type == "hybrid":
        signals.append(ScoreSignal(weight=22, value=1, reason="Hybrid fuel type supports lower running costs"))
    elif fuel_type in {"petrol", "gasoline"}:
        signals.append(ScoreSignal(weight=22, value=0.75, reason=f"{_get(listing, 'fuel_type')} fuel type is common and practical"))
    elif fuel_type == "electric":
        signals.append(ScoreSignal(weight=22, value=0.65, reason="Electric fuel type can be efficient with reliable charging"))
    elif fuel_type == "diesel":
        signals.append(ScoreSignal(weight=22, value=0.35, warning="Diesel may add ownership complexity for short daily trips"))
    else:
        signals.append(ScoreSignal(weight=22, value=0.2, warning="Fuel type has limited daily-driver signal"))

    if not _has_value(_get(listing, "condition")):
        signals.append(ScoreSignal(weight=12, value=0, missing="Condition not listed"))
    elif condition == "used":
        signals.append(ScoreSignal(weight=12, value=0.85, reason="Used condition aligns with daily-driver shopping"))
    elif condition == "new":
        signals.append(ScoreSignal(weight=12, value=0.55, reason="New condition can work, with separate value review"))
    else:
        signals.append(ScoreSignal(weight=12, value=0.35, warning="Condition needs buyer review"))

    if _mentions_clean_ownership_signal(listing):
        signals.append(ScoreSignal(weight=16, value=1, reason="Seller notes mention maintenance, title, ownership, or tire care"))
    else:
        signals.append(ScoreSignal(weight=16, value=0, missing="No maintenance, title, ownership, or tire-care note"))

    return _finalize_score(signals)


def score_listing_for_niche(listing: Any, niche_id: str | None) -> dict[str, Any]:
    if niche_id == BUDGET_DAILY_NICHE_ID:
        return _budget_daily_scorecard(listing)
    return _cold_weather_scorecard(listing)


def score_listing_for_all_niches(listing: Any) -> dict[str, dict[str, Any]]:
    return {
        DEFAULT_NICHE_ID: _cold_weather_scorecard(listing),
        BUDGET_DAILY_NICHE_ID: _budget_daily_scorecard(listing),
    }
