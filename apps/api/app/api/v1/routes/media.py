from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.core.deps import get_current_user
from app.db.session import get_session
from app.models.user import User
from app.models.car import CarListing, CarMedia
from app.schemas.media import PresignRequest, PresignResponse, MediaCompleteRequest
from app.services.s3 import make_storage_key, presign_put
from app.core.config import settings

router = APIRouter(tags=["media"])

def ensure_owner(car: CarListing, user: User):
    if car.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your listing")

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
    return {"ok": True, "media_id": media.id, "public_url": media.public_url}
