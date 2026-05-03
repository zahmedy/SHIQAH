from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from app.core.deps import get_current_user
from app.db.session import get_session
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut, NotificationUnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = False,
    limit: int = 40,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    safe_limit = min(max(limit, 1), 100)
    statement = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        statement = statement.where(Notification.read_at.is_(None))
    notifications = session.exec(
        statement.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(safe_limit)
    ).all()
    return [NotificationOut(**notification.model_dump()) for notification in notifications]


@router.get("/unread-count", response_model=NotificationUnreadCountOut)
def unread_notification_count(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = session.exec(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    ).one()
    try:
        unread_count = int(result)
    except (TypeError, ValueError):
        unread_count = int(result[0])
    return NotificationUnreadCountOut(unread_count=unread_count)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    notification = session.exec(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.read_at:
        notification.read_at = datetime.utcnow()
        session.add(notification)
        session.commit()
        session.refresh(notification)

    return NotificationOut(**notification.model_dump())


@router.post("/read-all")
def mark_all_notifications_read(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    notifications = session.exec(
        select(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    ).all()
    now = datetime.utcnow()
    for notification in notifications:
        notification.read_at = now
        session.add(notification)
    session.commit()
    return {"ok": True, "updated": len(notifications)}
