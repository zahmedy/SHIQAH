from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.deps import require_admin
from app.db.session import get_session
from app.models.car import CarListing, CarStatus
from app.services.review import ADMIN_REVIEW_SOURCE, approve_listing, reject_listing

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/cars/{car_id}/approve")
def approve_car(
    car_id: int,
    session: Session = Depends(get_session),
    admin=Depends(require_admin),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    if car.status != CarStatus.pending_review:
        raise HTTPException(status_code=400, detail="Only pending_review can be approved")

    car = approve_listing(session, car, review_source=ADMIN_REVIEW_SOURCE)
    return {"ok": True, "status": car.status.value, "published_at": car.published_at}


@router.post("/cars/{car_id}/reject")
def reject_car(
    car_id: int,
    reason: str,
    session: Session = Depends(get_session),
    admin=Depends(require_admin),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")
    if car.status != CarStatus.pending_review:
        raise HTTPException(status_code=400, detail="Only pending_review can be rejected")

    car = reject_listing(session, car, review_source=ADMIN_REVIEW_SOURCE, review_reason=reason)
    return {"ok": True, "status": car.status.value, "reason": reason}
