from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.user import User
from app.models.car import CarListing, CarStatus
from app.models.lead import Lead
from app.models.report import ReportType, UserReport
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
from app.services.notifications import create_notification

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
            Lead.rejected_at.is_(None),
            Lead.accepted_at.is_not(None),
        )
        .order_by(Lead.accepted_at.desc(), Lead.id.desc())
    ).first()


def _offer_sort_key(offer: Lead) -> tuple[int, float, int]:
    return (
        offer.amount or 0,
        offer.created_at.timestamp() if offer.created_at else 0,
        offer.id or 0,
    )


def _dedupe_highest_offers(offers: list[Lead]) -> list[Lead]:
    highest_by_buyer: dict[str, Lead] = {}
    for offer in offers:
        buyer_key = f"user:{offer.buyer_user_id}" if offer.buyer_user_id is not None else f"offer:{offer.id}"
        current = highest_by_buyer.get(buyer_key)
        if current is None or _offer_sort_key(offer) > _offer_sort_key(current):
            highest_by_buyer[buyer_key] = offer
    return sorted(highest_by_buyer.values(), key=_offer_sort_key, reverse=True)


def _active_offers_for_car(session: Session, car_id: int, channels: set[str]) -> list[Lead]:
    return session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(channels),
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
        )
        .order_by(Lead.amount.desc(), Lead.created_at.desc(), Lead.id.desc())
    ).all()


def _offer_count_for_car(session: Session, car_id: int) -> int:
    return len(_dedupe_highest_offers(_active_offers_for_car(session, car_id, PUBLIC_OFFER_CHANNELS)))


def _top_offers_for_car(session: Session, car_id: int, limit: int = 5) -> list[Lead]:
    return _dedupe_highest_offers(_active_offers_for_car(session, car_id, PUBLIC_OFFER_CHANNELS))[:limit]


def _viewer_private_offers_for_car(session: Session, car_id: int, viewer_id: int, limit: int = 5) -> list[Lead]:
    offers = session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel == "offer_private",
            Lead.buyer_user_id == viewer_id,
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
        )
        .order_by(Lead.created_at.desc(), Lead.id.desc())
    ).all()
    return _dedupe_highest_offers(offers)[:limit]


def _highest_buyer_offer_for_car(session: Session, car_id: int, buyer_id: int) -> Lead | None:
    offers = session.exec(
        select(Lead)
        .where(
            Lead.car_id == car_id,
            Lead.channel.in_(ALL_OFFER_CHANNELS),
            Lead.buyer_user_id == buyer_id,
            Lead.amount.is_not(None),
            Lead.rejected_at.is_(None),
        )
        .order_by(Lead.amount.desc(), Lead.created_at.desc(), Lead.id.desc())
    ).all()
    return next(iter(_dedupe_highest_offers(offers)), None)


def _highest_offer_amount_for_car(session: Session, car_id: int) -> int | None:
    offer = next(iter(_top_offers_for_car(session, car_id, limit=1)), None)
    return offer.amount if offer and offer.amount is not None else None


def _highest_public_offer_for_car(session: Session, car_id: int) -> Lead | None:
    return next(iter(_top_offers_for_car(session, car_id, limit=1)), None)


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
    if buyer:
        buyer_label = f"@{buyer.user_id}" if buyer.user_id else buyer.name or buyer.email or buyer.phone_e164
    return OwnerOfferOut(
        id=offer.id or 0,
        amount=offer.amount or 0,
        created_at=offer.created_at,
        accepted_at=offer.accepted_at,
        visibility=_offer_visibility(offer),
        buyer_user_id=offer.buyer_user_id,
        buyer_user_label=buyer_label,
        phone_e164=offer.phone_e164,
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
    if payload.visibility not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="Invalid offer type")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid offer amount")

    if user.id == car.owner_id:
        raise HTTPException(status_code=400, detail="You cannot bid on your own listing")

    if _accepted_offer_for_car(session, car_id):
        raise HTTPException(status_code=400, detail="Bidding is closed for this listing")

    previous_buyer_offer = _highest_buyer_offer_for_car(session, car_id, user.id or 0)
    if previous_buyer_offer is not None and payload.amount <= (previous_buyer_offer.amount or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Your offer must be higher than your current offer of {previous_buyer_offer.amount} USD",
        )

    previous_public_offer = None
    if payload.visibility == "public":
        if not car.public_bidding_enabled:
            raise HTTPException(status_code=400, detail="Public bidding is disabled for this listing")
        previous_public_offer = _highest_public_offer_for_car(session, car_id)
        if previous_public_offer is not None and payload.amount <= (previous_public_offer.amount or 0):
            raise HTTPException(status_code=400, detail=f"Your bid must be higher than the current highest bid of {previous_public_offer.amount} USD")

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
    create_notification(
        session,
        user_id=car.owner_id,
        actor_user_id=user.id,
        car_id=car.id,
        notification_type="offer_created",
        title="New offer",
        body=f"New {_offer_visibility(lead)} offer of {payload.amount} USD on {car.year} {car.make} {car.model}.",
        metadata={"amount": payload.amount, "visibility": payload.visibility},
    )
    if (
        payload.visibility == "public"
        and previous_public_offer
        and previous_public_offer.buyer_user_id
        and previous_public_offer.buyer_user_id != user.id
    ):
        create_notification(
            session,
            user_id=previous_public_offer.buyer_user_id,
            actor_user_id=user.id,
            car_id=car.id,
            notification_type="offer_outbid",
            title="You were outbid",
            body=f"A higher public bid was placed on {car.year} {car.make} {car.model}.",
            metadata={"amount": payload.amount, "previous_amount": previous_public_offer.amount},
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
    highest_offer = _highest_offer_amount_for_car(session, car_id)
    offers = _top_offers_for_car(session, car_id)
    if user:
        private_offers = _viewer_private_offers_for_car(session, car_id, user.id or 0)
        offers = _dedupe_highest_offers([*offers, *private_offers])[:10]
        visible_highest_offer = next(iter(offers), None)
        highest_offer = visible_highest_offer.amount if visible_highest_offer else highest_offer
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

    offers = _dedupe_highest_offers(_active_offers_for_car(session, car_id, ALL_OFFER_CHANNELS))
    buyer_ids = sorted({offer.buyer_user_id for offer in offers if offer.buyer_user_id})
    buyers = {}
    if buyer_ids:
        buyer_rows = session.exec(select(User).where(User.id.in_(buyer_ids))).all()
        buyers = {buyer.id or 0: buyer for buyer in buyer_rows if buyer.id is not None}

    accepted_offer = _accepted_offer_for_car(session, car_id)
    highest_offer = offers[0].amount if offers else None
    report_counts = _false_bid_report_counts(session, car_id, [offer.id or 0 for offer in offers if offer.id])

    return OwnerOfferSummaryOut(
        highest_offer=highest_offer,
        offer_count=len(offers),
        bidding_open=accepted_offer is None,
        public_bidding_enabled=car.public_bidding_enabled,
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
