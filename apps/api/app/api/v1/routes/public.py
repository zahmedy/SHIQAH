from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.car import CarListing, CarStatus, CarMedia
from app.schemas.car import CarOut, CarPhoto, PublicCarDetailOut
from app.models.user import User
from app.services.niche_scoring import score_listing_for_all_niches

router = APIRouter(prefix="/public", tags=["public"])

@router.get("/cars/{car_id}", response_model=PublicCarDetailOut)
def public_car_detail(car_id: int, session: Session = Depends(get_session)):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    if car.status != CarStatus.active:
        raise HTTPException(status_code=404, detail="Not found")
    seller = session.exec(select(User).where(User.id == car.owner_id)).first()

    photos = session.exec(
        select(CarMedia)
        .where(CarMedia.car_id == car.id)
        .order_by(CarMedia.is_cover.desc(), CarMedia.sort_order.asc(), CarMedia.id.asc())
    ).all()

    data = car.model_dump()
    data["status"] = car.status.value
    data["photos"] = [
        CarPhoto(id=p.id, public_url=p.public_url, sort_order=p.sort_order, is_cover=p.is_cover)
        for p in photos
    ]
    data["niche_scores"] = score_listing_for_all_niches(car)
    out = CarOut(**data)

    seller_phone = seller.phone_e164 if seller else None
    message_text = f"Hello, I'm interested in listing #{car.id}: {car.make} {car.model} {car.year}."
    sms_url = None
    whatsapp_url = None
    if seller and seller_phone and seller.contact_text_enabled:
        sms_url = f"sms:{seller_phone}?&body={quote(message_text)}"
    if seller and seller_phone and seller.contact_whatsapp_enabled:
        phone = seller_phone.replace("+", "")
        whatsapp_url = f"https://wa.me/{phone}?text={quote(message_text)}"

    return {
        "listing": out.model_dump(),
        "seller": {
            "id": seller.id if seller else None,
            "name": seller.name if seller else None,
            "user_id": seller.user_id if seller else None,
        },
        "contact": {
            "sms_url": sms_url,
            "whatsapp_url": whatsapp_url,
        },
    }
