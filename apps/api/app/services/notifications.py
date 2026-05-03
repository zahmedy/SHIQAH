from sqlmodel import Session

from app.models.notification import Notification


def create_notification(
    session: Session,
    *,
    user_id: int | None,
    notification_type: str,
    title: str,
    body: str,
    actor_user_id: int | None = None,
    car_id: int | None = None,
    metadata: dict | None = None,
) -> Notification | None:
    if user_id is None or actor_user_id == user_id:
        return None

    notification = Notification(
        user_id=user_id,
        actor_user_id=actor_user_id,
        car_id=car_id,
        type=notification_type,
        title=title,
        body=body,
        metadata_json=metadata,
    )
    session.add(notification)
    return notification
