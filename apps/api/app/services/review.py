from datetime import datetime

import redis
from rq import Queue
from sqlmodel import Session, select, func

from app.core.config import settings
from app.db.session import engine
from app.models.car import CarListing, CarMedia, CarStatus
from app.services.notifications import create_notification

AUTO_REVIEW_SOURCE = "auto"
ADMIN_REVIEW_SOURCE = "admin"

DISALLOWED_TERMS = (
    "wa.me",
    "whatsapp",
    "http://",
    "https://",
    "instagram",
    "snapchat",
    "telegram",
)


def approve_listing(
    session: Session,
    car: CarListing,
    *,
    review_source: str,
    review_reason: str | None = None,
) -> CarListing:
    car.status = CarStatus.active
    car.published_at = datetime.utcnow()
    car.updated_at = datetime.utcnow()
    car.reviewed_at = datetime.utcnow()
    car.review_source = review_source
    car.review_reason = review_reason

    session.add(car)
    create_notification(
        session,
        user_id=car.owner_id,
        notification_type="listing_approved",
        title="Listing approved",
        body=f"Your {car.year} {car.make} {car.model} listing is live.",
        car_id=car.id,
        metadata={"review_source": review_source},
    )
    session.commit()
    session.refresh(car)
    return car


def reject_listing(
    session: Session,
    car: CarListing,
    *,
    review_source: str,
    review_reason: str,
) -> CarListing:
    car.status = CarStatus.rejected
    car.updated_at = datetime.utcnow()
    car.reviewed_at = datetime.utcnow()
    car.review_source = review_source
    car.review_reason = review_reason

    session.add(car)
    create_notification(
        session,
        user_id=car.owner_id,
        notification_type="listing_rejected",
        title="Listing needs changes",
        body=review_reason,
        car_id=car.id,
        metadata={"review_source": review_source},
    )
    session.commit()
    session.refresh(car)
    return car


def _photo_count(session: Session, car_id: int) -> int:
    photo_count_result = session.exec(
        select(func.count()).select_from(CarMedia).where(CarMedia.car_id == car_id)
    ).one()
    try:
        return int(photo_count_result)
    except (TypeError, ValueError):
        return int(photo_count_result[0])


def auto_review_listing(session: Session, car: CarListing) -> CarListing:
    if not car.title.strip():
        car.title = f"{car.make} {car.model} {car.year} for sale"

    content = f"{car.title}\n{car.description or ''}".lower()

    if _photo_count(session, car.id) < 4:
        return reject_listing(
            session,
            car,
            review_source=AUTO_REVIEW_SOURCE,
            review_reason="At least 4 photos are required.",
        )

    if any(term in content for term in DISALLOWED_TERMS):
        return reject_listing(
            session,
            car,
            review_source=AUTO_REVIEW_SOURCE,
            review_reason="External contact info is not allowed in the listing text.",
        )

    return approve_listing(
        session,
        car,
        review_source=AUTO_REVIEW_SOURCE,
        review_reason="Automatically approved.",
    )


def review_listing_job(car_id: int) -> None:
    with Session(engine) as session:
        car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
        if not car or car.status != CarStatus.pending_review:
            return
        auto_review_listing(session, car)


def enqueue_auto_review(car_id: int) -> None:
    try:
        redis_conn = redis.from_url(settings.REDIS_URL)
        queue = Queue("default", connection=redis_conn)
        queue.enqueue(review_listing_job, car_id)
    except Exception:
        review_listing_job(car_id)

