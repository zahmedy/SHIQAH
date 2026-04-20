import base64
import binascii
import logging
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.core.deps import get_current_user
from app.core.config import settings
from app.db.session import get_session
from app.models.chat import ChatMessage
from app.models.lead import Lead
from app.models.user import User
from app.models.car import CarListing, CarStatus, CarMedia
from app.schemas.car import (
    CarCreate,
    CarUpdate,
    CarOut,
    CarPhoto,
    DescriptionFillRequest,
    DescriptionFillResponse,
    VinDecodeRequest,
    VinScanRequest,
    VinScanResponse,
)
from app.services.opensearch import delete_car, upsert_car
from app.services.s3 import delete_object
from app.services.review import build_search_doc, enqueue_auto_review
from app.services.description import generate_listing_description
from app.services.vin import decode_vin
from app.services.vision import detect_vin_from_image, normalize_vin

router = APIRouter(tags=["cars"])
logger = logging.getLogger(__name__)

MAX_VIN_IMAGE_BYTES = 8 * 1024 * 1024


def ensure_owner(car: CarListing, user: User):
    if car.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your listing")


def default_listing_title(make: str, model: str, year: int) -> str:
    return f"{make} {model} {year} for sale"


def _mask_vin(vin: str | None) -> str | None:
    if not vin:
        return None
    if len(vin) <= 6:
        return "***"
    return f"{vin[:3]}***{vin[-4:]}"


def _debug_vin_payload(payload: dict) -> dict:
    return {
        **payload,
        "vin": _mask_vin(str(payload.get("vin") or "")),
    }


def _load_photos_map(session: Session, car_ids: list[int]) -> dict[int, list[CarPhoto]]:
    if not car_ids:
        return {}

    photos = session.exec(
        select(CarMedia)
        .where(CarMedia.car_id.in_(car_ids))
        .order_by(CarMedia.car_id.asc(), CarMedia.sort_order.asc(), CarMedia.id.asc())
    ).all()

    photos_map: dict[int, list[CarPhoto]] = defaultdict(list)
    for photo in photos:
        photos_map[photo.car_id].append(
            CarPhoto(
                id=photo.id,
                public_url=photo.public_url,
                sort_order=photo.sort_order,
                is_cover=photo.is_cover,
            )
        )
    return photos_map


def to_car_out(car: CarListing, photos: list[CarPhoto] | None = None) -> CarOut:
    data = car.model_dump()
    status = data.get("status")
    if isinstance(status, CarStatus):
        data["status"] = status.value
    elif status is not None:
        data["status"] = str(status)
    data["photos"] = photos or []
    return CarOut(**data)


@router.post("/cars/vin/scan", response_model=VinScanResponse)
def scan_vin_photo(
    payload: VinScanRequest,
    user: User = Depends(get_current_user),
):
    content_type = payload.content_type.strip().lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload an image of the VIN.")

    try:
        image_bytes = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid VIN image payload.") from exc

    if not image_bytes:
        raise HTTPException(status_code=400, detail="VIN image is empty.")
    if len(image_bytes) > MAX_VIN_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="VIN image is too large.")

    try:
        vin = detect_vin_from_image(image_bytes, content_type)
    except RuntimeError as exc:
        if settings.VIN_SCAN_DEBUG:
            logger.exception("VIN scan configuration error")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        if settings.VIN_SCAN_DEBUG:
            logger.exception("VIN scan OCR request failed")
        raise HTTPException(status_code=502, detail="Failed to read VIN from image.") from exc

    if not vin:
        if settings.VIN_SCAN_DEBUG:
            logger.info("VIN scan completed without a valid VIN")
        raise HTTPException(status_code=422, detail="No valid VIN was detected in the image.")

    if settings.VIN_SCAN_DEBUG:
        logger.info("VIN scan detected VIN: %s", _mask_vin(vin))

    try:
        decoded = decode_vin(vin)
    except Exception:
        if settings.VIN_SCAN_DEBUG:
            logger.exception("VIN decoder request failed for VIN %s", _mask_vin(vin))
        decoded = {
            "vin": vin,
            "message": "VIN detected, but vehicle details could not be decoded.",
        }

    if settings.VIN_SCAN_DEBUG:
        logger.info("VIN scan decoded payload: %s", _debug_vin_payload(decoded))

    return VinScanResponse(**decoded)


@router.post("/cars/vin/decode", response_model=VinScanResponse)
def decode_typed_vin(
    payload: VinDecodeRequest,
    user: User = Depends(get_current_user),
):
    vin = normalize_vin(payload.vin)
    if not vin:
        raise HTTPException(status_code=400, detail="Enter a valid 17-character VIN.")

    try:
        decoded = decode_vin(vin)
    except Exception as exc:
        if settings.VIN_SCAN_DEBUG:
            logger.exception("Typed VIN decoder request failed for VIN %s", _mask_vin(vin))
        raise HTTPException(status_code=502, detail="Failed to decode VIN.") from exc

    if settings.VIN_SCAN_DEBUG:
        logger.info("Typed VIN decoded payload: %s", _debug_vin_payload(decoded))

    return VinScanResponse(**decoded)


@router.post("/cars/description/fill", response_model=DescriptionFillResponse)
def fill_car_description(
    payload: DescriptionFillRequest,
    user: User = Depends(get_current_user),
):
    if payload.year < 1980 or payload.year > datetime.utcnow().year + 1:
        raise HTTPException(status_code=400, detail="Invalid year")

    try:
        description = generate_listing_description(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to generate description.") from exc

    return DescriptionFillResponse(description_ar=description)


@router.post("/cars", response_model=CarOut)
def create_car(
    payload: CarCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    title = (payload.title_ar or "").strip() or default_listing_title(payload.make, payload.model, payload.year)

    if payload.year < 1980 or payload.year > datetime.utcnow().year + 1:
        raise HTTPException(status_code=400, detail="Invalid year")
    if payload.price_sar is not None and payload.price_sar <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")
    if (payload.latitude is None) != (payload.longitude is None):
        raise HTTPException(status_code=400, detail="Latitude and longitude must be provided together")
    if payload.latitude is not None and not (-90 <= payload.latitude <= 90):
        raise HTTPException(status_code=400, detail="Invalid latitude")
    if payload.longitude is not None and not (-180 <= payload.longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid longitude")

    car = CarListing(
        owner_id=user.id,
        status=CarStatus.draft,
        **payload.model_dump(exclude={"title_ar"}),
        title_ar=title,
    )
    session.add(car)
    session.commit()
    session.refresh(car)
    photos_map = _load_photos_map(session, [car.id])
    return to_car_out(car, photos=photos_map.get(car.id, []))


@router.get("/cars/{car_id}", response_model=CarOut)
def get_car(
    car_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)
    photos_map = _load_photos_map(session, [car.id])
    return to_car_out(car, photos=photos_map.get(car.id, []))


@router.patch("/cars/{car_id}", response_model=CarOut)
def update_car(
    car_id: int,
    payload: CarUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)

    if car.status not in (CarStatus.draft, CarStatus.pending_review, CarStatus.rejected, CarStatus.active, CarStatus.expired):
        raise HTTPException(status_code=400, detail="Only draft/pending/rejected/active/inactive can be edited")

    data = payload.model_dump(exclude_unset=True)
    if "year" in data:
        y = data["year"]
        if y < 1980 or y > datetime.utcnow().year + 1:
            raise HTTPException(status_code=400, detail="Invalid year")
    if "price_sar" in data and data["price_sar"] is not None and data["price_sar"] <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")
    if "latitude" in data or "longitude" in data:
        next_lat = data.get("latitude", car.latitude)
        next_lon = data.get("longitude", car.longitude)
        if (next_lat is None) != (next_lon is None):
            raise HTTPException(status_code=400, detail="Latitude and longitude must be provided together")
        if next_lat is not None and not (-90 <= next_lat <= 90):
            raise HTTPException(status_code=400, detail="Invalid latitude")
        if next_lon is not None and not (-180 <= next_lon <= 180):
            raise HTTPException(status_code=400, detail="Invalid longitude")

    next_make = data.get("make", car.make)
    next_model = data.get("model", car.model)
    next_year = data.get("year", car.year)
    if "title_ar" in data:
        data["title_ar"] = (data["title_ar"] or "").strip() or default_listing_title(next_make, next_model, next_year)

    for k, v in data.items():
        setattr(car, k, v)
    if car.status == CarStatus.rejected:
        car.status = CarStatus.draft
        car.reviewed_at = None
        car.review_source = None
        car.review_reason = None
    car.updated_at = datetime.utcnow()

    session.add(car)
    session.commit()
    session.refresh(car)
    if car.status == CarStatus.active:
        upsert_car(str(car.id), build_search_doc(session, car))
    photos_map = _load_photos_map(session, [car.id])
    return to_car_out(car, photos=photos_map.get(car.id, []))


@router.get("/seller/cars", response_model=list[CarOut])
def my_cars(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    cars = session.exec(
        select(CarListing).where(CarListing.owner_id == user.id).order_by(CarListing.created_at.desc())
    ).all()
    car_ids = [car.id for car in cars]
    photos_map = _load_photos_map(session, car_ids)
    return [to_car_out(car, photos=photos_map.get(car.id, [])) for car in cars]


@router.post("/cars/{car_id}/submit", response_model=CarOut)
def submit_car(
    car_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)

    if car.status not in (CarStatus.draft, CarStatus.expired):
        raise HTTPException(status_code=400, detail="Only draft or inactive listings can be submitted")

    # MVP publish gates (tighten later)
    if not car.title_ar or not car.title_ar.strip():
        car.title_ar = default_listing_title(car.make, car.model, car.year)
    if not car.description_ar:
        raise HTTPException(status_code=400, detail="Missing description")
    # sqlmodel may return a scalar int or a row-like object depending on backend/version.
    photo_count_result = session.exec(
        select(func.count()).select_from(CarMedia).where(CarMedia.car_id == car.id)
    ).one()
    try:
        photo_count = int(photo_count_result)
    except (TypeError, ValueError):
        photo_count = int(photo_count_result[0])

    # ensure min of 4 photos
    if photo_count < 4:
        raise HTTPException(status_code=400, detail="At least 4 photos required")

    car.status = CarStatus.pending_review
    car.updated_at = datetime.utcnow()
    car.reviewed_at = None
    car.review_source = None
    car.review_reason = None

    session.add(car)
    session.commit()
    enqueue_auto_review(car.id)
    session.refresh(car)
    photos_map = _load_photos_map(session, [car.id])
    return to_car_out(car, photos=photos_map.get(car.id, []))


@router.post("/cars/{car_id}/archive", response_model=CarOut)
def archive_owner_car(
    car_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)

    if car.status == CarStatus.expired:
        photos_map = _load_photos_map(session, [car.id])
        return to_car_out(car, photos=photos_map.get(car.id, []))

    car.status = CarStatus.expired
    car.updated_at = datetime.utcnow()
    session.add(car)
    session.commit()
    session.refresh(car)
    delete_car(str(car_id))
    photos_map = _load_photos_map(session, [car.id])
    return to_car_out(car, photos=photos_map.get(car.id, []))


@router.delete("/cars/{car_id}/permanent")
def permanently_delete_owner_car(
    car_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)

    media_items = session.exec(select(CarMedia).where(CarMedia.car_id == car_id)).all()
    storage_keys = [media.storage_key for media in media_items]
    chat_messages = session.exec(select(ChatMessage).where(ChatMessage.car_id == car_id)).all()
    leads = session.exec(select(Lead).where(Lead.car_id == car_id)).all()

    for media in media_items:
        session.delete(media)
    for message in chat_messages:
        session.delete(message)
    for lead in leads:
        session.delete(lead)

    session.flush()
    session.delete(car)
    session.commit()

    delete_car(str(car_id))
    for storage_key in storage_keys:
        try:
            delete_object(storage_key)
        except Exception:
            pass

    return {"ok": True}
