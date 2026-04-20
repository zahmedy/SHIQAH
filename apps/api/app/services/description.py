import json
import urllib.request

from app.core.config import settings
from app.schemas.car import DescriptionFillRequest


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
    return {
        key: value
        for key, value in payload.model_dump().items()
        if value not in (None, "")
    }


def generate_listing_description(payload: DescriptionFillRequest) -> str:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required for AI description fill.")

    request_body = {
        "model": settings.OPENAI_TEXT_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "You write honest used-car marketplace descriptions. "
                    "Use only facts provided by the user. Do not invent features, service records, "
                    "accident history, warranty, seller contact info, or ownership claims. "
                    "Return JSON only."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Draft a concise buyer-facing listing description in English for this car. "
                    "Aim for 80 to 130 words. Emphasize practical cold-weather commuter details "
                    "when supported by the provided fields. Avoid hype, emojis, and external contact info. "
                    "Return exactly JSON with a description_ar string.\n\n"
                    f"Car fields: {json.dumps(_compact_payload(payload), ensure_ascii=False)}"
                ),
            },
        ],
        "max_tokens": 260,
        "temperature": 0.4,
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
