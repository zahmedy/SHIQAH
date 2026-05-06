from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.user import User
from app.models.car import CarListing, CarStatus
from app.models.lead import Lead
from app.models.report import ReportType, UserReport
from app.schemas.lead import (
    CounterOfferCreate,
    LeadCreate,
    LeadOut,
    OfferCreate,
    OfferOut,
    OfferSummaryOut,
    OwnerOfferOut,
    OwnerOfferSummaryOut,
)
from app.core.deps import get_current_user, get_optional_current_user
from app.services.notifications import create_notification

router = APIRouter(tags=["leads"])
OFFER_EXPIRATION_DAYS = 7
COUNTER_OFFER_CHANNEL = "offer_counter"
ALL_OFFER_CHANNELS = {"offer", "offer_public", "offer_private", COUNTER_OFFER_CHANNEL}


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
            Lead.rejected_at.is_(None),
            Lead.accepted_at.is_not(None),
        )
        .order_by(Lead.accepted_at.desc(), Lead.id.desc())
    ).first()


def _offer_expires_at(now: datetime | None = None) -> datetime:
    return (now or datetime.utcnow()) + timedelta(days=OFFER_EXPIRATION_DAYS)


def _offer_is_expired(offer: Lead, now: datetime | None = None) -> bool:
    if not offer.expires_at:
        return False
    return offer.expires_at <= (now or datetime.utcnow())


def _offer_sort_key(offer: Lead) -> tuple[int, float, int]:
    return (
        offer.amount or 0,
        offer.created_at.timestamp() if offer.created_at else 0,
        offer.id or 0,
    )


def _latest_offer_sort_key(offer: Lead) -> tuple[float, int]:
    return (
        offer.created_at.timestamp() if offer.created_at else 0,
        offer.id or 0,
    )


def _dedupe_latest_offers(offers: list[Lead]) -> list[Lead]:
    latest_by_buyer: dict[str, Lead] = {}
    for offer in offers:
        buyer_key = f"user:{offer.buyer_user_id}" if offer.buyer_user_id is not None else f"offer:{offer.id}"
        current = latest_by_buyer.get(buyer_key)
        if current is None or _latest_offer_sort_key(offer) > _latest_offer_sort_key(current):
            latest_by_buyer[buyer_key] = offer
    return sorted(latest_by_buyer.values(), key=_latest_offer_sort_key, reverse=True)


def _active_offers_for_car(session: Session, car_id: int, channels: set[str]) -> list[Lead]:
    now = datetime.utcnow()
    return session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(channels),
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
            (Lead.expires_at.is_(None)) | (Lead.expires_at > now),
        )
        .order_by(Lead.created_at.desc(), Lead.id.desc())
    ).all()


def _offer_count_for_car(session: Session, car_id: int) -> int:
    return len(_dedupe_latest_offers(_active_offers_for_car(session, car_id, ALL_OFFER_CHANNELS)))


def _viewer_private_offers_for_car(session: Session, car_id: int, viewer_id: int, limit: int = 5) -> list[Lead]:
    now = datetime.utcnow()
    offers = session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.buyer_user_id == viewer_id,
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
            (Lead.expires_at.is_(None)) | (Lead.expires_at > now),
        )
        .order_by(Lead.created_at.desc(), Lead.id.desc())
    ).all()
    return _dedupe_latest_offers(offers)[:limit]


def _highest_buyer_offer_for_car(session: Session, car_id: int, buyer_id: int) -> Lead | None:
    now = datetime.utcnow()
    offers = session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.buyer_user_id == buyer_id,
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
            (Lead.expires_at.is_(None)) | (Lead.expires_at > now),
        )
        .order_by(Lead.created_at.desc(), Lead.id.desc())
    ).all()
    return next(iter(_dedupe_latest_offers(offers)), None)


def _buyer_active_offers_for_car(session: Session, car_id: int, buyer_id: int) -> list[Lead]:
    now = datetime.utcnow()
    return session.exec(
        select(Lead).where(
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.buyer_user_id == buyer_id,
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
            Lead.accepted_at.is_(None),
            (Lead.expires_at.is_(None)) | (Lead.expires_at > now),
        )
    ).all()


def _is_counteroffer(offer: Lead) -> bool:
    return offer.channel == COUNTER_OFFER_CHANNEL


def _offer_out(offer: Lead) -> OfferOut:
    return OfferOut(
        id=offer.id or 0,
        amount=offer.amount or 0,
        created_at=offer.created_at,
        accepted_at=offer.accepted_at,
        rejected_at=offer.rejected_at,
        expires_at=offer.expires_at,
        is_counteroffer=_is_counteroffer(offer),
    )


def _false_bid_report_counts(session: Session, car_id: int, offer_ids: list[int]) -> dict[int, int]:
    if not offer_ids:
        return {}

    reports = session.exec(
        select(UserReport).where(
            UserReport.car_id == car_id,
            UserReport.offer_id.in_(offer_ids),
            UserReport.report_type == ReportType.false_bid,
        )
    ).all()
    counts: dict[int, int] = {}
    for report in reports:
        if report.offer_id is not None:
            counts[report.offer_id] = counts.get(report.offer_id, 0) + 1
    return counts


def _owner_offer_out(offer: Lead, buyers: dict[int, User], false_bid_report_count: int = 0) -> OwnerOfferOut:
    buyer = buyers.get(offer.buyer_user_id or -1)
    buyer_label = None
    buyer_email = None
    buyer_phone = offer.phone_e164
    buyer_text_enabled = False
    buyer_whatsapp_enabled = False
    if buyer:
        buyer_label = f"@{buyer.user_id}" if buyer.user_id else buyer.name or buyer.email or buyer.phone_e164
        buyer_email = buyer.email
        buyer_phone = buyer.phone_e164 or buyer_phone
        buyer_text_enabled = buyer.contact_text_enabled
        buyer_whatsapp_enabled = buyer.contact_whatsapp_enabled
    return OwnerOfferOut(
        id=offer.id or 0,
        amount=offer.amount or 0,
        created_at=offer.created_at,
        accepted_at=offer.accepted_at,
        rejected_at=offer.rejected_at,
        expires_at=offer.expires_at,
        is_counteroffer=_is_counteroffer(offer),
        buyer_user_id=offer.buyer_user_id,
        buyer_user_label=buyer_label,
        buyer_email=buyer_email,
        phone_e164=buyer_phone,
        buyer_contact_text_enabled=buyer_text_enabled,
        buyer_contact_whatsapp_enabled=buyer_whatsapp_enabled,
        false_bid_report_count=false_bid_report_count,
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
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid offer amount")

    if user.id == car.owner_id:
        raise HTTPException(status_code=400, detail="You cannot make an offer on your own listing")

    if _accepted_offer_for_car(session, car_id):
        raise HTTPException(status_code=400, detail="Offers are closed for this listing")

    now = datetime.utcnow()
    for active_offer in _buyer_active_offers_for_car(session, car_id, user.id or 0):
        active_offer.rejected_at = now
        session.add(active_offer)

    lead = Lead(
        car_id=car.id,
        owner_id=car.owner_id,
        buyer_user_id=user.id,
        phone_e164=user.phone_e164,
        message=None,
        amount=payload.amount,
        channel="offer",
        expires_at=_offer_expires_at(now),
    )
    session.add(lead)
    create_notification(
        session,
        user_id=car.owner_id,
        actor_user_id=user.id,
        car_id=car.id,
        notification_type="offer_created",
        title="New offer",
        body=f"New offer of {payload.amount} USD on {car.year} {car.make} {car.model}.",
        metadata={"amount": payload.amount, "expires_at": lead.expires_at.isoformat() if lead.expires_at else None},
    )
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
    offers: list[Lead] = []
    if user:
        offers = _viewer_private_offers_for_car(session, car_id, user.id or 0)
    can_view_accepted_offer = (
        accepted_offer is not None
        and user is not None
        and user.id == accepted_offer.buyer_user_id
    )

    return OfferSummaryOut(
        list_price=car.price,
        offer_count=offer_count,
        offers_open=accepted_offer is None,
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

    offers = _dedupe_latest_offers(_active_offers_for_car(session, car_id, ALL_OFFER_CHANNELS))
    buyer_ids = sorted({offer.buyer_user_id for offer in offers if offer.buyer_user_id})
    buyers = {}
    if buyer_ids:
        buyer_rows = session.exec(select(User).where(User.id.in_(buyer_ids))).all()
        buyers = {buyer.id or 0: buyer for buyer in buyer_rows if buyer.id is not None}

    accepted_offer = _accepted_offer_for_car(session, car_id)
    report_counts = _false_bid_report_counts(session, car_id, [offer.id or 0 for offer in offers if offer.id])

    return OwnerOfferSummaryOut(
        list_price=car.price,
        offer_count=len(offers),
        offers_open=accepted_offer is None,
        accepted_offer=_owner_offer_out(accepted_offer, buyers, report_counts.get(accepted_offer.id or 0, 0)) if accepted_offer else None,
        offers=[_owner_offer_out(offer, buyers, report_counts.get(offer.id or 0, 0)) for offer in offers],
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
            Lead.rejected_at.is_(None),
        )
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if _offer_is_expired(offer):
        raise HTTPException(status_code=400, detail="Offer has expired")

    accepted_offer = _accepted_offer_for_car(session, car_id)
    if accepted_offer and accepted_offer.id != offer.id:
        raise HTTPException(status_code=400, detail="An offer has already been accepted for this listing")

    if not offer.accepted_at:
        offer.accepted_at = datetime.utcnow()
        session.add(offer)
        create_notification(
            session,
            user_id=offer.buyer_user_id,
            actor_user_id=user.id,
            car_id=car.id,
            notification_type="offer_accepted",
            title="Offer accepted",
            body=f"Your offer of {offer.amount} USD was accepted for {car.year} {car.make} {car.model}.",
            metadata={"offer_id": offer.id, "amount": offer.amount},
        )
        session.commit()
        session.refresh(offer)

    buyers = {}
    if offer.buyer_user_id:
        buyer = session.exec(select(User).where(User.id == offer.buyer_user_id)).first()
        if buyer and buyer.id is not None:
            buyers[buyer.id] = buyer

    report_counts = _false_bid_report_counts(session, car_id, [offer.id or 0] if offer.id else [])
    return _owner_offer_out(offer, buyers, report_counts.get(offer.id or 0, 0))


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
            Lead.rejected_at.is_(None),
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

    report_counts = _false_bid_report_counts(session, car_id, [offer.id or 0] if offer.id else [])
    return _owner_offer_out(offer, buyers, report_counts.get(offer.id or 0, 0))


@router.post("/cars/{car_id}/offers/{offer_id}/counter", response_model=OwnerOfferOut)
def counter_offer(
    car_id: int,
    offer_id: int,
    payload: CounterOfferCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = _load_active_car(session, car_id)
    if user.id != car.owner_id:
        raise HTTPException(status_code=403, detail="Only the listing owner can counter offers")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid counteroffer amount")
    if _accepted_offer_for_car(session, car_id):
        raise HTTPException(status_code=400, detail="Offers are closed for this listing")

    offer = session.exec(
        select(Lead).where(
            Lead.id == offer_id,
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
        )
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if _offer_is_expired(offer):
        raise HTTPException(status_code=400, detail="Offer has expired")
    if offer.buyer_user_id is None:
        raise HTTPException(status_code=400, detail="Offer has no buyer account")

    now = datetime.utcnow()
    for active_offer in _buyer_active_offers_for_car(session, car_id, offer.buyer_user_id):
        active_offer.rejected_at = now
        session.add(active_offer)

    counter = Lead(
        car_id=car.id,
        owner_id=car.owner_id,
        buyer_user_id=offer.buyer_user_id,
        phone_e164=offer.phone_e164,
        message=None,
        amount=payload.amount,
        channel=COUNTER_OFFER_CHANNEL,
        expires_at=_offer_expires_at(now),
    )
    session.add(counter)
    create_notification(
        session,
        user_id=offer.buyer_user_id,
        actor_user_id=user.id,
        car_id=car.id,
        notification_type="offer_countered",
        title="Counteroffer received",
        body=f"The seller sent a counteroffer of {payload.amount} USD for {car.year} {car.make} {car.model}.",
        metadata={"offer_id": offer.id, "amount": payload.amount, "expires_at": counter.expires_at.isoformat() if counter.expires_at else None},
    )
    session.commit()
    session.refresh(counter)

    buyers = {}
    buyer = session.exec(select(User).where(User.id == offer.buyer_user_id)).first()
    if buyer and buyer.id is not None:
        buyers[buyer.id] = buyer

    return _owner_offer_out(counter, buyers, 0)


@router.post("/cars/{car_id}/offers/{offer_id}/reject", response_model=OwnerOfferOut)
def reject_offer(
    car_id: int,
    offer_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = _load_active_car(session, car_id)
    if user.id != car.owner_id:
        raise HTTPException(status_code=403, detail="Only the listing owner can reject offers")

    offer = session.exec(
        select(Lead).where(
            Lead.id == offer_id,
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
        )
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.accepted_at:
        raise HTTPException(status_code=400, detail="Unaccept the offer before rejecting it")

    now = datetime.utcnow()
    offers_to_reject = [offer]
    if offer.buyer_user_id is not None:
        offers_to_reject = session.exec(
            select(Lead).where(
                Lead.car_id == car_id,
                Lead.channel.in_(ALL_OFFER_CHANNELS),
                Lead.amount.is_not(None),
                Lead.rejected_at.is_(None),
                Lead.accepted_at.is_(None),
                Lead.buyer_user_id == offer.buyer_user_id,
            )
        ).all()

    for offer_to_reject in offers_to_reject:
        offer_to_reject.rejected_at = now
        session.add(offer_to_reject)
    create_notification(
        session,
        user_id=offer.buyer_user_id,
        actor_user_id=user.id,
        car_id=car.id,
        notification_type="offer_rejected",
        title="Offer rejected",
        body=f"Your offer for {car.year} {car.make} {car.model} was rejected.",
        metadata={"offer_id": offer.id, "amount": offer.amount},
    )
    session.commit()
    session.refresh(offer)

    buyers = {}
    if offer.buyer_user_id:
        buyer = session.exec(select(User).where(User.id == offer.buyer_user_id)).first()
        if buyer and buyer.id is not None:
            buyers[buyer.id] = buyer

    report_counts = _false_bid_report_counts(session, car_id, [offer.id or 0] if offer.id else [])
    return _owner_offer_out(offer, buyers, report_counts.get(offer.id or 0, 0))


@router.get("/seller/leads", response_model=list[LeadOut])
def my_leads(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    leads = session.exec(
        select(Lead).where(Lead.owner_id == user.id).order_by(Lead.created_at.desc())
    ).all()
    return [LeadOut(**lead.model_dump()) for lead in leads]
