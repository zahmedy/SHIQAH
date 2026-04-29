import io
import logging
import os
import re
from collections.abc import Iterable

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError

from app.core.config import settings


logger = logging.getLogger("uvicorn.error")
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
VIN_OCR_TRANSLATION = str.maketrans({"I": "1", "O": "0", "Q": "0"})
OCR_CONFIGS = (
    "--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
    "--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
    "--oem 3 --psm 11 -c tessedit_char_whitelist=ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
    "--oem 3 --psm 13 -c tessedit_char_whitelist=ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
)
REKOGNITION_MAX_IMAGE_BYTES = 4_750_000


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
    return next(iter_vin_candidates(raw_text), None)


def iter_vin_candidates(raw_text: str) -> Iterable[str]:
    candidate_text = re.sub(r"[^A-Z0-9]", "", raw_text.upper().translate(VIN_OCR_TRANSLATION))
    seen: set[str] = set()
    for index in range(max(len(candidate_text) - 16, 0)):
        vin = candidate_text[index:index + 17]
        if vin in seen:
            continue
        seen.add(vin)
        if VIN_RE.fullmatch(vin) and is_valid_vin(vin):
            yield vin


def is_valid_vin(vin: str) -> bool:
    if not VIN_RE.fullmatch(vin):
        return False

    total = 0
    for character, weight in zip(vin, VIN_WEIGHTS, strict=True):
        total += VIN_TRANSLITERATION[character] * weight

    remainder = total % 11
    expected_check_digit = "X" if remainder == 10 else str(remainder)
    return vin[8] == expected_check_digit


def _load_ocr_modules():
    try:
        import pytesseract
        from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError
    except ImportError as exc:
        raise RuntimeError("VIN OCR dependencies are missing. Install pytesseract and Pillow.") from exc
    return pytesseract, Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError


def _scale_for_ocr(image):
    width, height = image.size
    longest_side = max(width, height)
    if longest_side >= 2200:
        return image
    scale = 2200 / max(longest_side, 1)
    return image.resize((round(width * scale), round(height * scale)))


def _build_ocr_images(image_bytes: bytes):
    _pytesseract, Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError = _load_ocr_modules()
    try:
        image = Image.open(io.BytesIO(image_bytes))
    except UnidentifiedImageError as exc:
        raise ValueError("Invalid VIN image payload.") from exc

    base = ImageOps.exif_transpose(image).convert("RGB")
    grayscale = ImageOps.grayscale(_scale_for_ocr(base))
    contrast = ImageOps.autocontrast(grayscale)
    sharpened = contrast.filter(ImageFilter.SHARPEN)
    high_contrast = ImageEnhance.Contrast(sharpened).enhance(2.0)
    thresholded = high_contrast.point(lambda value: 255 if value > 145 else 0)
    inverted = ImageOps.invert(thresholded)

    return (contrast, sharpened, high_contrast, thresholded, inverted)


def _prepare_rekognition_image_bytes(image_bytes: bytes) -> bytes:
    if len(image_bytes) <= REKOGNITION_MAX_IMAGE_BYTES:
        return image_bytes

    _pytesseract, Image, _ImageEnhance, _ImageFilter, ImageOps, UnidentifiedImageError = _load_ocr_modules()
    try:
        image = Image.open(io.BytesIO(image_bytes))
    except UnidentifiedImageError as exc:
        raise ValueError("Invalid VIN image payload.") from exc

    prepared = ImageOps.exif_transpose(image).convert("RGB")
    prepared.thumbnail((1800, 1800))
    output = io.BytesIO()
    prepared.save(output, format="JPEG", quality=86, optimize=True)
    return output.getvalue()


def _should_try_aws_rekognition(provider: str) -> bool:
    if provider == "aws_rekognition":
        return True
    if provider != "auto":
        return False
    if settings.VIN_OCR_AWS_ACCESS_KEY_ID and settings.VIN_OCR_AWS_SECRET_ACCESS_KEY:
        return True
    return any(
        os.getenv(name)
        for name in (
            "AWS_ACCESS_KEY_ID",
            "AWS_PROFILE",
            "AWS_WEB_IDENTITY_TOKEN_FILE",
            "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
            "AWS_CONTAINER_CREDENTIALS_FULL_URI",
        )
    )


def _aws_rekognition_client():
    client_kwargs = {
        "region_name": settings.VIN_OCR_AWS_REGION,
        "config": Config(connect_timeout=3, read_timeout=12, retries={"max_attempts": 2, "mode": "standard"}),
    }
    if settings.VIN_OCR_AWS_ACCESS_KEY_ID and settings.VIN_OCR_AWS_SECRET_ACCESS_KEY:
        client_kwargs["aws_access_key_id"] = settings.VIN_OCR_AWS_ACCESS_KEY_ID
        client_kwargs["aws_secret_access_key"] = settings.VIN_OCR_AWS_SECRET_ACCESS_KEY
        if settings.VIN_OCR_AWS_SESSION_TOKEN:
            client_kwargs["aws_session_token"] = settings.VIN_OCR_AWS_SESSION_TOKEN
    return boto3.client("rekognition", **client_kwargs)


def _detect_vin_with_aws_rekognition(image_bytes: bytes) -> str | None:
    client = _aws_rekognition_client()
    response = client.detect_text(Image={"Bytes": _prepare_rekognition_image_bytes(image_bytes)})
    detections = response.get("TextDetections") or []
    high_confidence_text: list[str] = []
    all_text: list[str] = []
    for detection in detections:
        detected_text = str(detection.get("DetectedText") or "")
        if not detected_text:
            continue
        all_text.append(detected_text)
        confidence = float(detection.get("Confidence") or 0)
        if confidence >= settings.VIN_OCR_MIN_CONFIDENCE:
            high_confidence_text.append(detected_text)

    for text in high_confidence_text:
        vin = normalize_vin(text)
        if vin:
            return vin

    vin = normalize_vin(" ".join(high_confidence_text))
    if vin:
        return vin

    return normalize_vin(" ".join(all_text))


def _detect_vin_with_tesseract(image_bytes: bytes) -> str | None:
    pytesseract, *_modules = _load_ocr_modules()
    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

    for image in _build_ocr_images(image_bytes):
        for config in OCR_CONFIGS:
            raw_text = pytesseract.image_to_string(image, config=config)
            vin = normalize_vin(raw_text)
            if vin:
                return vin

    return None


def detect_vin_from_image(image_bytes: bytes, content_type: str) -> str | None:
    if not content_type.startswith("image/"):
        return None

    provider = settings.VIN_OCR_PROVIDER.strip().lower()
    if provider not in {"auto", "aws_rekognition", "tesseract"}:
        raise RuntimeError("VIN_OCR_PROVIDER must be auto, aws_rekognition, or tesseract.")

    if _should_try_aws_rekognition(provider):
        try:
            vin = _detect_vin_with_aws_rekognition(image_bytes)
            if vin:
                return vin
        except (BotoCoreError, ClientError, NoCredentialsError) as exc:
            if provider == "aws_rekognition":
                raise RuntimeError("AWS Rekognition VIN OCR failed.") from exc
            if settings.VIN_SCAN_DEBUG:
                logger.exception("AWS Rekognition VIN OCR failed; falling back to Tesseract")

    if provider == "aws_rekognition":
        return None

    return _detect_vin_with_tesseract(image_bytes)
