from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.db.session import get_session
from app.models.user import User
from app.models.car import CarListing, CarStatus
from app.models.lead import Lead
from app.schemas.lead import LeadCreate, LeadOut, OfferCreate, OfferOut, OfferSummaryOut
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
        amount_sar=payload.amount_sar,
        channel=payload.channel,
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)

    return LeadOut(**lead.model_dump())


@router.post("/cars/{car_id}/offers", response_model=OfferOut)
def create_offer(
    car_id: int,
    payload: OfferCreate,
    session: Session = Depends(get_session),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car or car.status != CarStatus.active:
        raise HTTPException(status_code=404, detail="Listing not found")

    if payload.amount_sar <= 0:
        raise HTTPException(status_code=400, detail="Invalid offer amount")

    lead = Lead(
        car_id=car.id,
        owner_id=car.owner_id,
        buyer_user_id=None,
        phone_e164=payload.phone_e164,
        message=payload.message,
        amount_sar=payload.amount_sar,
        channel="offer",
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)

    return OfferOut(id=lead.id or 0, amount_sar=lead.amount_sar or 0, created_at=lead.created_at)


@router.get("/cars/{car_id}/offers", response_model=OfferSummaryOut)
def get_offers(
    car_id: int,
    session: Session = Depends(get_session),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car or car.status != CarStatus.active:
        raise HTTPException(status_code=404, detail="Listing not found")

    total_count_result = session.exec(
        select(func.count()).select_from(Lead).where(
            Lead.car_id == car_id,
            Lead.channel == "offer",
            Lead.amount_sar.is_not(None),
        )
    ).one()
    try:
        offer_count = int(total_count_result)
    except (TypeError, ValueError):
        offer_count = int(total_count_result[0])

    offers = session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel == "offer",
            Lead.amount_sar.is_not(None),
        )
        .order_by(Lead.amount_sar.desc(), Lead.created_at.desc())
        .limit(5)
    ).all()

    highest_offer = offers[0].amount_sar if offers else None

    return OfferSummaryOut(
        highest_offer_sar=highest_offer,
        offer_count=offer_count,
        offers=[
            OfferOut(
                id=offer.id or 0,
                amount_sar=offer.amount_sar or 0,
                created_at=offer.created_at,
            )
            for offer in offers
        ],
    )


@router.get("/seller/leads", response_model=list[LeadOut])
def my_leads(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    leads = session.exec(
        select(Lead).where(Lead.owner_id == user.id).order_by(Lead.created_at.desc())
    ).all()
    return [LeadOut(**lead.model_dump()) for lead in leads]
