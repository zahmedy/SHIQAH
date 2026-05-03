from datetime import datetime

import redis
from rq import Queue
from sqlmodel import Session, select, func

from app.core.config import settings
from app.db.session import engine
from app.models.car import CarListing, CarMedia, CarStatus
from app.models.user import User
from app.services.notifications import create_notification
from app.services.opensearch import delete_car, upsert_car

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


def build_search_doc(session: Session, car: CarListing) -> dict:
    photos = session.exec(
        select(CarMedia)
        .where(CarMedia.car_id == car.id)
        .order_by(CarMedia.is_cover.desc(), CarMedia.sort_order.asc(), CarMedia.id.asc())
    ).all()
    seller = session.exec(select(User).where(User.id == car.owner_id)).first()

    doc = {
        "id": str(car.id),
        "owner_id": car.owner_id,
        "seller_name": seller.name if seller and seller.name else None,
        "seller_user_id": seller.user_id if seller and seller.user_id else None,
        "city": car.city,
        "district": car.district,
        "make": car.make,
        "model": car.model,
        "year": car.year,
        "price": car.price,
        "mileage": car.mileage,
        "body_type": car.body_type,
        "transmission": car.transmission,
        "fuel_type": car.fuel_type,
        "drivetrain": car.drivetrain,
        "condition": car.condition,
        "title": car.title,
        "description": car.description,
        "photos": [
            {
                "id": photo.id,
                "public_url": photo.public_url,
                "sort_order": photo.sort_order,
                "is_cover": photo.is_cover,
            }
            for photo in photos
        ],
        "published_at": car.published_at.isoformat() if car.published_at else None,
    }
    if car.latitude is not None and car.longitude is not None:
        doc["location"] = {"lat": car.latitude, "lon": car.longitude}
    return doc


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
    upsert_car(str(car.id), build_search_doc(session, car))
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
    delete_car(str(car.id))
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

    content = f"{car.title}\n{car.description}".lower()

    if not car.description.strip():
        return reject_listing(
            session,
            car,
            review_source=AUTO_REVIEW_SOURCE,
            review_reason="Missing description.",
        )

    if len(car.description.strip()) < 20:
        return reject_listing(
            session,
            car,
            review_source=AUTO_REVIEW_SOURCE,
            review_reason="Description is too short for auto-approval.",
        )

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


def reindex_owner_active_listings(session: Session, owner_id: int) -> None:
    cars = session.exec(
        select(CarListing)
        .where(CarListing.owner_id == owner_id, CarListing.status == CarStatus.active)
    ).all()
    for car in cars:
        upsert_car(str(car.id), build_search_doc(session, car))
