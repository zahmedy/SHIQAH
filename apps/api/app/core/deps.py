from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.user import User, UserRole
from app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/verify-email-code")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/v1/auth/verify-email-code", auto_error=False)

def get_current_user(session: Session = Depends(get_session), token: str = Depends(oauth2_scheme)) -> User:
    sub = decode_token(token)
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Backward compatibility: old tokens use phone_e164; new tokens use user.id.
    user = None
    if sub.isdigit():
        user = session.get(User, int(sub))
    if not user:
        user = session.exec(select(User).where(User.phone_e164 == sub)).first()
    if not user:
        user = session.exec(select(User).where(User.email == sub)).first()

    if not user or user.is_banned:
        raise HTTPException(status_code=401, detail="User not found or banned")
    return user


def get_optional_current_user(
    session: Session = Depends(get_session),
    token: str | None = Depends(oauth2_scheme_optional),
) -> User | None:
    if not token:
        return None

    sub = decode_token(token)
    if not sub:
        return None

    user = None
    if sub.isdigit():
        user = session.get(User, int(sub))
    if not user:
        user = session.exec(select(User).where(User.phone_e164 == sub)).first()
    if not user:
        user = session.exec(select(User).where(User.email == sub)).first()

    if not user or user.is_banned:
        return None
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user
