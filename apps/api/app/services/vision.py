import base64
import json
import re
import urllib.request

from app.core.config import settings


VIN_RE = re.compile(r"\b[A-HJ-NPR-Z0-9]{17}\b")
VIN_TRANSLITERATION = {
    **{str(number): number for number in range(10)},
    "A": 1,
    "B": 2,
    "C": 3,
    "D": 4,
    "E": 5,
    "F": 6,
    "G": 7,
    "H": 8,
    "J": 1,
    "K": 2,
    "L": 3,
    "M": 4,
    "N": 5,
    "P": 7,
    "R": 9,
    "S": 2,
    "T": 3,
    "U": 4,
    "V": 5,
    "W": 6,
    "X": 7,
    "Y": 8,
    "Z": 9,
}
VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]


def predict_car_attributes(photo_urls: list[str]) -> dict:
    # Stub predictor for plumbing validation. Replace this with a real
    # model or external vision service once the end-to-end pipeline works.
    photo_count = len(photo_urls)
    return {
        "source": "stub-v1",
        "make": "Toyota",
        "model": "Camry",
        "year_start": 2020,
        "year_end": 2022,
        "confidence": min(0.35 + photo_count * 0.1, 0.8),
        "raw": {
            "note": "stub result",
            "photo_count": photo_count,
            "photo_urls": photo_urls,
        },
    }


def normalize_vin(raw_text: str) -> str | None:
    candidate_text = re.sub(r"[^A-Z0-9]", "", raw_text.upper())
    candidate_text = candidate_text.replace("I", "1").replace("O", "0").replace("Q", "0")
    match = VIN_RE.search(candidate_text)
    if not match:
        return None

    vin = match.group(0)
    return vin if is_valid_vin(vin) else None


def is_valid_vin(vin: str) -> bool:
    if not VIN_RE.fullmatch(vin):
        return False

    total = 0
    for character, weight in zip(vin, VIN_WEIGHTS, strict=True):
        total += VIN_TRANSLITERATION[character] * weight

    remainder = total % 11
    expected_check_digit = "X" if remainder == 10 else str(remainder)
    return vin[8] == expected_check_digit


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


def detect_vin_from_image(image_bytes: bytes, content_type: str) -> str | None:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is required for VIN photo detection.")

    encoded_image = base64.b64encode(image_bytes).decode("ascii")
    request_body = {
        "model": settings.OPENAI_VISION_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Read the VIN from this vehicle label or windshield photo. "
                            "Return only JSON with a vin field. A VIN is exactly 17 characters "
                            "and never contains I, O, or Q. If no VIN is readable, use an empty string."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{content_type};base64,{encoded_image}",
                        },
                    },
                ],
            }
        ],
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
        payload = json.loads(response.read().decode("utf-8"))

    content = payload["choices"][0]["message"]["content"]
    result = _extract_json_object(content)
    vin = normalize_vin(str(result.get("vin") or ""))
    if vin:
        return vin

    return normalize_vin(content)
