from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.core.deps import get_current_user
from app.db.session import get_session
from app.models.user import User
from app.models.car import CarListing, CarStatus, CarMedia
from app.schemas.car import CarCreate, CarUpdate, CarOut, CarPhoto

router = APIRouter(tags=["cars"])


def ensure_owner(car: CarListing, user: User):
    if car.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your listing")


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


@router.post("/cars", response_model=CarOut)
def create_car(
    payload: CarCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if payload.year < 1980 or payload.year > datetime.utcnow().year + 1:
        raise HTTPException(status_code=400, detail="Invalid year")
    if payload.price_sar <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")

    car = CarListing(
        owner_id=user.id,
        status=CarStatus.draft,
        **payload.model_dump(),
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

    if car.status not in (CarStatus.draft, CarStatus.pending_review):
        raise HTTPException(status_code=400, detail="Only draft/pending can be edited")

    data = payload.model_dump(exclude_unset=True)
    if "year" in data:
        y = data["year"]
        if y < 1980 or y > datetime.utcnow().year + 1:
            raise HTTPException(status_code=400, detail="Invalid year")
    if "price_sar" in data and data["price_sar"] is not None and data["price_sar"] <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")

    for k, v in data.items():
        setattr(car, k, v)
    car.updated_at = datetime.utcnow()

    session.add(car)
    session.commit()
    session.refresh(car)
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

    if car.status != CarStatus.draft:
        raise HTTPException(status_code=400, detail="Only draft can be submitted")

    # MVP publish gates (tighten later)
    if not car.title_ar or not car.description_ar:
        raise HTTPException(status_code=400, detail="Missing title/description")
    if car.price_sar <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")

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

    session.add(car)
    session.commit()
    session.refresh(car)
    photos_map = _load_photos_map(session, [car.id])
    return to_car_out(car, photos=photos_map.get(car.id, []))
