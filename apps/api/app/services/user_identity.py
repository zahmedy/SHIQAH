import re
from sqlmodel import Session, select
from app.models.user import User

USER_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$")
USER_ID_ERROR = "User ID must be 3-32 characters and use only letters, numbers, '.', '_' or '-'."


def normalize_user_id(value: str) -> str:
    normalized = value.strip().lower()
    if normalized.startswith("@"):
        normalized = normalized[1:]
    normalized = re.sub(r"\s+", "-", normalized)
    return normalized


def validate_user_id(value: str) -> str:
    normalized = normalize_user_id(value)
    if not USER_ID_PATTERN.fullmatch(normalized):
        raise ValueError(USER_ID_ERROR)
    return normalized


def is_user_id_taken(session: Session, user_id: str, *, exclude_user_id: int | None = None) -> bool:
    statement = select(User).where(User.user_id == user_id)
    if exclude_user_id is not None:
        statement = statement.where(User.id != exclude_user_id)
    return session.exec(statement).first() is not None


def ensure_user_id(session: Session, user: User) -> str:
    if user.user_id:
        return user.user_id
    if user.id is None:
        raise ValueError("User must be persisted before assigning a fallback user ID")

    user.user_id = f"user-{user.id}"
    session.add(user)
    session.commit()
    session.refresh(user)
    return user.user_id
