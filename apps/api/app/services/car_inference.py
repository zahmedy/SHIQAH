import json
from datetime import datetime

import redis
from rq import Queue
from sqlmodel import Session, select

from app.core.config import settings
from app.db.session import engine
from app.models.car import CarListing, CarMedia
from app.services.vision import predict_car_attributes


def _load_car(session: Session, car_id: int) -> CarListing | None:
    return session.exec(select(CarListing).where(CarListing.id == car_id)).first()


def _load_photo_urls(session: Session, car_id: int) -> list[str]:
    photos = session.exec(
        select(CarMedia)
        .where(CarMedia.car_id == car_id)
        .order_by(CarMedia.is_cover.desc(), CarMedia.sort_order.asc(), CarMedia.id.asc())
    ).all()
    return [photo.public_url for photo in photos]


def _mark_status(
    session: Session,
    car: CarListing,
    *,
    status: str,
    source: str | None = None,
    raw: dict | str | None = None,
) -> None:
    car.ml_status = status
    if source is not None:
        car.ml_source = source
    if raw is not None:
        car.ml_raw = raw if isinstance(raw, str) else json.dumps(raw)
    car.ml_updated_at = datetime.utcnow()
    session.add(car)
    session.commit()
    session.refresh(car)


def infer_car_attributes_job(car_id: int) -> None:
    with Session(engine) as session:
        car = _load_car(session, car_id)
        if not car:
            return

        photo_urls = _load_photo_urls(session, car_id)
        if not photo_urls:
            _mark_status(
                session,
                car,
                status="failed",
                source="stub-v1",
                raw={"error": "No photos available for inference."},
            )
            return

        _mark_status(session, car, status="running")
        prediction = predict_car_attributes(photo_urls)

        car.ml_status = "completed"
        car.ml_source = str(prediction.get("source") or "stub-v1")
        car.ml_make = str(prediction.get("make") or "") or None
        car.ml_model = str(prediction.get("model") or "") or None
        car.ml_year_start = int(prediction["year_start"]) if prediction.get("year_start") is not None else None
        car.ml_year_end = int(prediction["year_end"]) if prediction.get("year_end") is not None else None
        car.ml_confidence = float(prediction["confidence"]) if prediction.get("confidence") is not None else None
        car.ml_raw = json.dumps(prediction.get("raw") or prediction)
        car.ml_updated_at = datetime.utcnow()
        session.add(car)
        session.commit()


def enqueue_car_inference(car_id: int) -> None:
    with Session(engine) as session:
        car = _load_car(session, car_id)
        if not car:
            return
        _mark_status(session, car, status="queued", source="stub-v1")

    if settings.ENV != "prod":
        infer_car_attributes_job(car_id)
        return

    try:
        redis_conn = redis.from_url(settings.REDIS_URL)
        queue = Queue("default", connection=redis_conn)
        queue.enqueue(infer_car_attributes_job, car_id)
    except Exception:
        infer_car_attributes_job(car_id)
