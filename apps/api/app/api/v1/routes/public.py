from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.car import CarListing, CarStatus, CarMedia
from app.schemas.car import CarOut, CarPhoto

router = APIRouter(prefix="/public", tags=["public"])

@router.get("/cars/{car_id}", response_model=CarOut)
def public_car_detail(car_id: int, session: Session = Depends(get_session)):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    if car.status != CarStatus.active:
        raise HTTPException(status_code=404, detail="Not found")
    photos = session.exec(
        select(CarMedia).where(CarMedia.car_id == car.id).order_by(CarMedia.sort_order.asc(), CarMedia.id.asc())
    ).all()

    data = car.model_dump()
    data["status"] = car.status.value
    data["photos"] = [
        CarPhoto(id=p.id, public_url=p.public_url, sort_order=p.sort_order, is_cover=p.is_cover)
        for p in photos
    ]
    return CarOut(**data)
