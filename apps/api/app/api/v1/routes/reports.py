from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_admin
from app.db.session import get_session
from app.models.car import CarListing
from app.models.lead import Lead
from app.models.report import ReportStatus, ReportType, UserReport
from app.models.user import User
from app.schemas.report import (
    AdminReportOut,
    FalseBidReportCreate,
    ListingReportCreate,
    ReportOut,
    ReportUpdate,
)

router = APIRouter(tags=["reports"])

LISTING_REPORT_REASONS = {
    "misleading_details",
    "wrong_vehicle",
    "duplicate",
    "already_sold",
    "scam_or_spam",
    "prohibited_content",
    "other",
}

FALSE_BID_REASONS = {
    "fake_bid",
    "no_show",
    "spam",
    "could_not_contact",
    "payment_issue",
    "other",
}


def _clean_notes(value: str | None) -> str | None:
    cleaned = " ".join((value or "").strip().split())
    return cleaned or None


def _validate_reason(reason: str, allowed: set[str]) -> str:
    cleaned = reason.strip().lower()
    if cleaned not in allowed:
        raise HTTPException(status_code=400, detail="Invalid report reason")
    return cleaned


def _report_out(report: UserReport) -> ReportOut:
    return ReportOut(**report.model_dump())


def _user_label(user: User | None) -> str | None:
    if not user:
        return None
    return f"@{user.user_id}" if user.user_id else user.name or user.email or user.phone_e164 or f"User #{user.id}"


def _admin_report_out(
    report: UserReport,
    *,
    cars: dict[int, CarListing],
    offers: dict[int, Lead],
    users: dict[int, User],
) -> AdminReportOut:
    car = cars.get(report.car_id)
    offer = offers.get(report.offer_id or -1)
    return AdminReportOut(
        **report.model_dump(),
        listing_title=car.title if car else None,
        listing_vehicle=f"{car.year} {car.make} {car.model}" if car else None,
        offer_amount=offer.amount if offer else None,
        reporter_label=_user_label(users.get(report.reporter_user_id)),
        reported_user_label=_user_label(users.get(report.reported_user_id or -1)),
    )


@router.post("/cars/{car_id}/reports", response_model=ReportOut)
def report_listing(
    car_id: int,
    payload: ListingReportCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.get(CarListing, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Listing not found")
    if car.owner_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot report your own listing")

    report = UserReport(
        report_type=ReportType.listing,
        car_id=car.id or car_id,
        reporter_user_id=user.id or 0,
        reported_user_id=car.owner_id,
        reason=_validate_reason(payload.reason, LISTING_REPORT_REASONS),
        notes=_clean_notes(payload.notes),
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return _report_out(report)


@router.post("/cars/{car_id}/offers/{offer_id}/reports", response_model=ReportOut)
def report_false_bid(
    car_id: int,
    offer_id: int,
    payload: FalseBidReportCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.get(CarListing, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Listing not found")
    if car.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the listing owner can report a false bid")

    offer = session.exec(
        select(Lead).where(
            Lead.id == offer_id,
            Lead.car_id == car_id,
            Lead.amount.is_not(None),
            Lead.channel.in_(["offer", "offer_public", "offer_private"]),
        )
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    report = UserReport(
        report_type=ReportType.false_bid,
        car_id=car.id or car_id,
        offer_id=offer.id,
        reporter_user_id=user.id or 0,
        reported_user_id=offer.buyer_user_id,
        reason=_validate_reason(payload.reason, FALSE_BID_REASONS),
        notes=_clean_notes(payload.notes),
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return _report_out(report)


@router.get("/admin/reports", response_model=list[AdminReportOut])
def list_reports(
    status: ReportStatus | None = Query(default=None),
    report_type: ReportType | None = Query(default=None),
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    statement = select(UserReport)
    if status is not None:
        statement = statement.where(UserReport.status == status)
    if report_type is not None:
        statement = statement.where(UserReport.report_type == report_type)
    reports = session.exec(statement.order_by(UserReport.created_at.desc(), UserReport.id.desc()).limit(200)).all()

    car_ids = sorted({report.car_id for report in reports})
    offer_ids = sorted({report.offer_id for report in reports if report.offer_id})
    user_ids = sorted(
        {
            user_id
            for report in reports
            for user_id in (report.reporter_user_id, report.reported_user_id)
            if user_id
        }
    )

    cars = {car.id or 0: car for car in session.exec(select(CarListing).where(CarListing.id.in_(car_ids))).all()} if car_ids else {}
    offers = {offer.id or 0: offer for offer in session.exec(select(Lead).where(Lead.id.in_(offer_ids))).all()} if offer_ids else {}
    users = {row.id or 0: row for row in session.exec(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}

    return [_admin_report_out(report, cars=cars, offers=offers, users=users) for report in reports]


@router.patch("/admin/reports/{report_id}", response_model=AdminReportOut)
def update_report(
    report_id: int,
    payload: ReportUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    report = session.get(UserReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if payload.status is None and payload.admin_notes is None:
        raise HTTPException(status_code=400, detail="At least one field is required")

    if payload.status is not None:
        report.status = payload.status
        report.reviewed_by_id = admin.id
        report.reviewed_at = datetime.utcnow()
    if payload.admin_notes is not None:
        report.admin_notes = _clean_notes(payload.admin_notes)
    report.updated_at = datetime.utcnow()

    session.add(report)
    session.commit()
    session.refresh(report)

    cars = {report.car_id: session.get(CarListing, report.car_id)}
    offers = {report.offer_id: session.get(Lead, report.offer_id)} if report.offer_id else {}
    user_ids = [user_id for user_id in (report.reporter_user_id, report.reported_user_id) if user_id]
    users = {row.id or 0: row for row in session.exec(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    return _admin_report_out(report, cars=cars, offers=offers, users=users)
