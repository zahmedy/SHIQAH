from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.user import User, UserRole
from app.models.car import CarListing, CarStatus
from app.core.config import settings
from app.services.opensearch import upsert_car
from app.services.review import build_search_doc

router = APIRouter(prefix="/dev", tags=["dev"])

@router.post("/make-admin")
def make_admin(phone_e164: str, session: Session = Depends(get_session)):
    # Safety: only allow in dev
    if settings.ENV != "dev":
        raise HTTPException(status_code=404, detail="Not found")

    user = session.exec(select(User).where(User.phone_e164 == phone_e164)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = UserRole.admin
    session.add(user)
    session.commit()
    return {"ok": True, "phone_e164": user.phone_e164, "role": user.role}


@router.post("/reindex-search")
def reindex_search(session: Session = Depends(get_session)):
    # Safety: only allow in dev
    if settings.ENV != "dev":
        raise HTTPException(status_code=404, detail="Not found")

    cars = session.exec(select(CarListing).where(CarListing.status == CarStatus.active)).all()
    for car in cars:
        doc = build_search_doc(session, car)
        upsert_car(str(car.id), doc)

    return {"ok": True, "indexed": len(cars)}
