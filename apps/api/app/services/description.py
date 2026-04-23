import json
import urllib.request

from app.core.config import settings
from app.schemas.car import DescriptionFillRequest

BANNED_DESCRIPTION_PHRASES = (
    "excellent choice",
    "great choice",
    "great opportunity",
    "reliable driving experience",
    "dependable car",
    "handle winter",
    "winter-ready",
    "snowy streets",
    "cold-weather commuting",
    "sleek",
)


def _extract_json_object(raw_text: str) -> dict:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError:
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start < 0 or end <= start:
            return {}
        try:
            payload = json.loads(raw_text[start:end + 1])
        except json.JSONDecodeError:
            return {}
    return payload if isinstance(payload, dict) else {}


def _compact_payload(payload: DescriptionFillRequest) -> dict:
    raw = {
        key: value
        for key, value in payload.model_dump().items()
        if value not in (None, "")
    }
    renamed: dict[str, object] = {}
    for key, value in raw.items():
        if key == "price_sar":
            renamed["price_usd"] = value
        elif key == "title_ar":
            renamed["title"] = value
        elif key == "description_ar":
            renamed["existing_description"] = value
        else:
            renamed[key] = value
    return renamed


def _validate_description(description: str) -> None:
    lowered = description.lower()
    if any(phrase in lowered for phrase in BANNED_DESCRIPTION_PHRASES):
        raise ValueError("AI description included unsupported sales language.")


def _build_messages(payload: DescriptionFillRequest, retry_plainer: bool = False) -> list[dict]:
    extra_instruction = (
        "The previous draft sounded too promotional or invented unsupported claims. "
        "Rewrite it in a plainer seller-note style with only neutral facts. "
        if retry_plainer
        else ""
    )
    return [
        {
            "role": "system",
            "content": (
                "You write honest used-car marketplace descriptions. "
                "Use only facts provided by the user. Keep the language natural and plain, "
                "like a careful seller wrote it. Do not invent features, service records, "
                "accident history, warranty, seller contact info, reliability, ownership claims, "
                "winter capability, or mechanical condition. "
                "Return JSON only."
            ),
        },
        {
            "role": "user",
            "content": (
                "Draft a concise buyer-facing listing description in English for this car. "
                "Aim for 55 to 90 words. Use a simple, natural tone. Mention the year, make, "
                "model, body type, color, transmission, fuel type, mileage, price, and location only "
                "when those fields are provided. All prices are in USD. If price_usd is present, refer to it as USD "
                "or omit the currency instead of using SAR. Do not say the car is reliable, dependable, excellent, "
                "great, ideal, sleek, smooth, practical, spacious, comfortable, winter-ready, or good "
                "for snowy streets unless the provided fields explicitly support that exact claim. "
                "Do not infer cold-weather ability from city, sedan body type, automatic transmission, "
                "petrol fuel, or used condition. If no winter-specific facts are provided, do not mention "
                "winter, snow, cold-weather commuting, traction, or city-specific weather. "
                "Avoid hype, emojis, and external contact info. "
                f"{extra_instruction}"
                "Return exactly JSON with a description_ar string.\n\n"
                f"Car fields: {json.dumps(_compact_payload(payload), ensure_ascii=False)}"
            ),
        },
    ]


def _request_description(payload: DescriptionFillRequest, retry_plainer: bool = False) -> str:
    request_body = {
        "model": settings.OPENAI_TEXT_MODEL,
        "response_format": {"type": "json_object"},
        "messages": _build_messages(payload, retry_plainer),
        "max_tokens": 260,
        "temperature": 0.25,
    }

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.loads(response.read().decode("utf-8"))

    content = result["choices"][0]["message"]["content"]
    parsed = _extract_json_object(content)
    description = str(parsed.get("description_ar") or "").strip()
    if not description:
        raise RuntimeError("AI description response was empty.")
    return description


def generate_listing_description(payload: DescriptionFillRequest) -> str:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required for AI description fill.")

    description = _request_description(payload)
    try:
        _validate_description(description)
    except ValueError:
        description = _request_description(payload, retry_plainer=True)
        _validate_description(description)
    return description
