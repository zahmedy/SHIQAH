from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.user import User
from app.models.car import CarListing, CarStatus
from app.models.lead import Lead
from app.schemas.lead import LeadCreate, LeadOut
from app.core.deps import get_current_user

router = APIRouter(tags=["leads"])


@router.post("/cars/{car_id}/leads", response_model=LeadOut)
def create_lead(
    car_id: int,
    payload: LeadCreate,
    session: Session = Depends(get_session),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car or car.status != CarStatus.active:
        raise HTTPException(status_code=404, detail="Listing not found")

    if payload.channel not in {"form", "whatsapp", "call"}:
        raise HTTPException(status_code=400, detail="Invalid channel")

    if payload.channel == "form" and not (payload.name or payload.phone_e164 or payload.message):
        raise HTTPException(status_code=400, detail="Provide at least one contact field")

    lead = Lead(
        car_id=car.id,
        owner_id=car.owner_id,
        buyer_user_id=None,
        name=payload.name,
        phone_e164=payload.phone_e164,
        message=payload.message,
        channel=payload.channel,
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)

    return LeadOut(**lead.model_dump())


@router.get("/seller/leads", response_model=list[LeadOut])
def my_leads(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    leads = session.exec(
        select(Lead).where(Lead.owner_id == user.id).order_by(Lead.created_at.desc())
    ).all()
    return [LeadOut(**lead.model_dump()) for lead in leads]
