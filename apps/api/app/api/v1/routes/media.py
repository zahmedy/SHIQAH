from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.core.deps import get_current_user
from app.db.session import get_session
from app.models.user import User
from app.models.car import CarListing, CarMedia, CarStatus
from app.schemas.media import PresignRequest, PresignResponse, MediaCompleteRequest
from app.services.s3 import delete_object, make_storage_key, presign_put
from app.core.config import settings
from app.services.car_inference import enqueue_car_inference
from app.services.opensearch import upsert_car
from app.services.review import build_search_doc

router = APIRouter(tags=["media"])

def ensure_owner(car: CarListing, user: User):
    if car.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your listing")


def normalize_car_media(session: Session, car_id: int, cover_media_id: int | None = None) -> None:
    media_items = session.exec(
        select(CarMedia)
        .where(CarMedia.car_id == car_id)
        .order_by(CarMedia.sort_order.asc(), CarMedia.id.asc())
    ).all()

    if cover_media_id is not None:
        prioritized = [media for media in media_items if media.id == cover_media_id]
        remaining = [media for media in media_items if media.id != cover_media_id]
        media_items = prioritized + remaining

    cover_found = False
    for index, media in enumerate(media_items):
        media.sort_order = index
        should_be_cover = False
        if not cover_found and (media.is_cover or index == 0):
            should_be_cover = True
            cover_found = True
        media.is_cover = should_be_cover
        session.add(media)

@router.post("/cars/{car_id}/media/presign", response_model=PresignResponse)
def presign_upload(
    car_id: int,
    payload: PresignRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)

    storage_key = make_storage_key(car_id, payload.filename)
    upload_url = presign_put(storage_key, payload.content_type)
    public_url = f"{settings.S3_PUBLIC_BASE_URL}/{storage_key}"
    return PresignResponse(upload_url=upload_url, storage_key=storage_key, public_url=public_url)

@router.post("/cars/{car_id}/media/complete")
def complete_upload(
    car_id: int,
    payload: MediaCompleteRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)

    # sqlmodel may return a scalar int or a row-like object depending on backend/version.
    count_result = session.exec(
        select(func.count()).select_from(CarMedia).where(CarMedia.car_id == car_id)
    ).one()
    try:
        sort_order = int(count_result)
    except (TypeError, ValueError):
        sort_order = int(count_result[0])

    media = CarMedia(
        car_id=car_id,
        storage_key=payload.storage_key,
        public_url=payload.public_url,
        sort_order=sort_order,
        is_cover=payload.is_cover,
    )
    session.add(media)
    session.commit()
    session.refresh(media)
    session.refresh(car)
    enqueue_car_inference(car_id)
    if car.status == CarStatus.active:
        upsert_car(str(car.id), build_search_doc(session, car))
    return {"ok": True, "media_id": media.id, "public_url": media.public_url}


@router.delete("/cars/{car_id}/media/{media_id}")
def delete_media(
    car_id: int,
    media_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)

    media = session.exec(
        select(CarMedia).where(CarMedia.id == media_id, CarMedia.car_id == car_id)
    ).first()
    if not media:
        raise HTTPException(status_code=404, detail="Photo not found")

    storage_key = media.storage_key
    session.delete(media)
    session.flush()
    normalize_car_media(session, car_id)
    session.commit()
    session.refresh(car)

    try:
        delete_object(storage_key)
    except Exception:
        pass

    if car.status == CarStatus.active:
        upsert_car(str(car.id), build_search_doc(session, car))

    return {"ok": True}


@router.post("/cars/{car_id}/media/{media_id}/main")
def set_main_media(
    car_id: int,
    media_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(car, user)

    media = session.exec(
        select(CarMedia).where(CarMedia.id == media_id, CarMedia.car_id == car_id)
    ).first()
    if not media:
        raise HTTPException(status_code=404, detail="Photo not found")

    normalize_car_media(session, car_id, cover_media_id=media_id)
    session.commit()
    session.refresh(car)

    if car.status == CarStatus.active:
        upsert_car(str(car.id), build_search_doc(session, car))

    return {"ok": True}
