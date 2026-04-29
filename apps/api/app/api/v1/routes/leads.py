from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.db.session import get_session
from app.models.user import User
from app.models.car import CarListing, CarStatus
from app.models.lead import Lead
from app.schemas.lead import (
    LeadCreate,
    LeadOut,
    OfferCreate,
    OfferOut,
    OfferSummaryOut,
    OwnerOfferOut,
    OwnerOfferSummaryOut,
)
from app.core.deps import get_current_user, get_optional_current_user

router = APIRouter(tags=["leads"])
PUBLIC_OFFER_CHANNELS = {"offer", "offer_public"}
ALL_OFFER_CHANNELS = {"offer", "offer_public", "offer_private"}


def _load_active_car(session: Session, car_id: int) -> CarListing:
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car or car.status != CarStatus.active:
        raise HTTPException(status_code=404, detail="Listing not found")
    return car


def _accepted_offer_for_car(session: Session, car_id: int) -> Lead | None:
    return session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.amount.is_not(None),
            Lead.accepted_at.is_not(None),
        )
        .order_by(Lead.accepted_at.desc(), Lead.id.desc())
    ).first()


def _offer_count_for_car(session: Session, car_id: int) -> int:
    total_count_result = session.exec(
        select(func.count()).select_from(Lead).where(
            Lead.car_id == car_id,
            Lead.channel.in_(PUBLIC_OFFER_CHANNELS),
            Lead.amount.is_not(None),
        )
    ).one()
    try:
        return int(total_count_result)
    except (TypeError, ValueError):
        return int(total_count_result[0])


def _top_offers_for_car(session: Session, car_id: int, limit: int = 5) -> list[Lead]:
    return session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(PUBLIC_OFFER_CHANNELS),
            Lead.amount.is_not(None),
        )
        .order_by(Lead.amount.desc(), Lead.created_at.desc())
        .limit(limit)
    ).all()


def _viewer_private_offers_for_car(session: Session, car_id: int, viewer_id: int, limit: int = 5) -> list[Lead]:
    return session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel == "offer_private",
            Lead.buyer_user_id == viewer_id,
            Lead.amount.is_not(None),
        )
        .order_by(Lead.created_at.desc(), Lead.id.desc())
        .limit(limit)
    ).all()


def _highest_offer_amount_for_car(session: Session, car_id: int) -> int | None:
    offer = session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(PUBLIC_OFFER_CHANNELS),
            Lead.amount.is_not(None),
        )
        .order_by(Lead.amount.desc(), Lead.created_at.desc())
    ).first()
    return offer.amount if offer and offer.amount is not None else None


def _offer_visibility(offer: Lead) -> str:
    return "private" if offer.channel == "offer_private" else "public"


def _offer_out(offer: Lead) -> OfferOut:
    return OfferOut(
        id=offer.id or 0,
        amount=offer.amount or 0,
        created_at=offer.created_at,
        accepted_at=offer.accepted_at,
        visibility=_offer_visibility(offer),
    )


def _owner_offer_out(offer: Lead, buyers: dict[int, User]) -> OwnerOfferOut:
    buyer = buyers.get(offer.buyer_user_id or -1)
    buyer_label = None
    if buyer:
        buyer_label = f"@{buyer.user_id}" if buyer.user_id else buyer.name or buyer.phone_e164
    return OwnerOfferOut(
        id=offer.id or 0,
        amount=offer.amount or 0,
        created_at=offer.created_at,
        accepted_at=offer.accepted_at,
        visibility=_offer_visibility(offer),
        buyer_user_id=offer.buyer_user_id,
        buyer_user_label=buyer_label,
        phone_e164=offer.phone_e164,
    )


@router.post("/cars/{car_id}/leads", response_model=LeadOut)
def create_lead(
    car_id: int,
    payload: LeadCreate,
    session: Session = Depends(get_session),
):
    car = _load_active_car(session, car_id)

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
        amount=payload.amount,
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
    user: User = Depends(get_current_user),
):
    car = _load_active_car(session, car_id)
    if payload.visibility not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="Invalid offer type")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid offer amount")

    if user.id == car.owner_id:
        raise HTTPException(status_code=400, detail="You cannot bid on your own listing")

    if not user.phone_e164:
        raise HTTPException(status_code=400, detail="A verified phone number is required to bid")

    if _accepted_offer_for_car(session, car_id):
        raise HTTPException(status_code=400, detail="Bidding is closed for this listing")

    if payload.visibility == "public":
        if not car.public_bidding_enabled:
            raise HTTPException(status_code=400, detail="Public bidding is disabled for this listing")
        highest_offer = _highest_offer_amount_for_car(session, car_id)
        if highest_offer is not None and payload.amount <= highest_offer:
            raise HTTPException(status_code=400, detail=f"Your bid must be higher than the current highest bid of {highest_offer} USD")

    offer_channel = "offer_public" if payload.visibility == "public" else "offer_private"

    lead = Lead(
        car_id=car.id,
        owner_id=car.owner_id,
        buyer_user_id=user.id,
        phone_e164=user.phone_e164,
        message=None,
        amount=payload.amount,
        channel=offer_channel,
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)

    return _offer_out(lead)


@router.get("/cars/{car_id}/offers", response_model=OfferSummaryOut)
def get_offers(
    car_id: int,
    session: Session = Depends(get_session),
    user: User | None = Depends(get_optional_current_user),
):
    car = _load_active_car(session, car_id)

    offer_count = _offer_count_for_car(session, car_id)
    accepted_offer = _accepted_offer_for_car(session, car_id)
    highest_offer = _highest_offer_amount_for_car(session, car_id)
    offers = _top_offers_for_car(session, car_id)
    if user:
        private_offers = _viewer_private_offers_for_car(session, car_id, user.id or 0)
        offers = sorted(
            [*offers, *private_offers],
            key=lambda offer: (
                -(offer.amount or 0),
                -(offer.created_at.timestamp() if offer.created_at else 0),
                -(offer.id or 0),
            ),
        )[:10]
    can_view_accepted_offer = (
        accepted_offer is not None
        and (
            accepted_offer.channel in PUBLIC_OFFER_CHANNELS
            or (user is not None and user.id == accepted_offer.buyer_user_id)
        )
    )

    return OfferSummaryOut(
        highest_offer=highest_offer,
        offer_count=offer_count,
        bidding_open=accepted_offer is None,
        public_bidding_enabled=car.public_bidding_enabled,
        accepted_offer=_offer_out(accepted_offer) if can_view_accepted_offer and accepted_offer else None,
        offers=[_offer_out(offer) for offer in offers],
    )


@router.get("/cars/{car_id}/offers/manage", response_model=OwnerOfferSummaryOut)
def get_manage_offers(
    car_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = _load_active_car(session, car_id)
    if user.id != car.owner_id:
        raise HTTPException(status_code=403, detail="Only the listing owner can manage offers")

    offers = session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.amount.is_not(None),
        )
        .order_by(Lead.amount.desc(), Lead.created_at.desc())
    ).all()
    buyer_ids = sorted({offer.buyer_user_id for offer in offers if offer.buyer_user_id})
    buyers = {}
    if buyer_ids:
        buyer_rows = session.exec(select(User).where(User.id.in_(buyer_ids))).all()
        buyers = {buyer.id or 0: buyer for buyer in buyer_rows if buyer.id is not None}

    accepted_offer = _accepted_offer_for_car(session, car_id)
    highest_offer = offers[0].amount if offers else None

    return OwnerOfferSummaryOut(
        highest_offer=highest_offer,
        offer_count=len(offers),
        bidding_open=accepted_offer is None,
        public_bidding_enabled=car.public_bidding_enabled,
        accepted_offer=_owner_offer_out(accepted_offer, buyers) if accepted_offer else None,
        offers=[_owner_offer_out(offer, buyers) for offer in offers],
    )


@router.post("/cars/{car_id}/offers/{offer_id}/accept", response_model=OwnerOfferOut)
def accept_offer(
    car_id: int,
    offer_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = _load_active_car(session, car_id)
    if user.id != car.owner_id:
        raise HTTPException(status_code=403, detail="Only the listing owner can accept offers")

    offer = session.exec(
        select(Lead).where(
            Lead.id == offer_id,
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.amount.is_not(None),
        )
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    accepted_offer = _accepted_offer_for_car(session, car_id)
    if accepted_offer and accepted_offer.id != offer.id:
        raise HTTPException(status_code=400, detail="An offer has already been accepted for this listing")

    if not offer.accepted_at:
        offer.accepted_at = datetime.utcnow()
        session.add(offer)
        session.commit()
        session.refresh(offer)

    buyers = {}
    if offer.buyer_user_id:
        buyer = session.exec(select(User).where(User.id == offer.buyer_user_id)).first()
        if buyer and buyer.id is not None:
            buyers[buyer.id] = buyer

    return _owner_offer_out(offer, buyers)


@router.post("/cars/{car_id}/offers/{offer_id}/unaccept", response_model=OwnerOfferOut)
def unaccept_offer(
    car_id: int,
    offer_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = _load_active_car(session, car_id)
    if user.id != car.owner_id:
        raise HTTPException(status_code=403, detail="Only the listing owner can unaccept offers")

    offer = session.exec(
        select(Lead).where(
            Lead.id == offer_id,
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.amount.is_not(None),
        )
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if not offer.accepted_at:
        raise HTTPException(status_code=400, detail="Offer is not currently accepted")

    offer.accepted_at = None
    session.add(offer)
    session.commit()
    session.refresh(offer)

    buyers = {}
    if offer.buyer_user_id:
        buyer = session.exec(select(User).where(User.id == offer.buyer_user_id)).first()
        if buyer and buyer.id is not None:
            buyers[buyer.id] = buyer

    return _owner_offer_out(offer, buyers)


@router.get("/seller/leads", response_model=list[LeadOut])
def my_leads(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    leads = session.exec(
        select(Lead).where(Lead.owner_id == user.id).order_by(Lead.created_at.desc())
    ).all()
    return [LeadOut(**lead.model_dump()) for lead in leads]
