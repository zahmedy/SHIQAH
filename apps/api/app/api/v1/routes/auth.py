from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.schemas.auth import OTPRequest, OTPVerify, TokenResponse
from app.db.session import get_session
from app.models.user import User, UserRole
from app.core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


def fallback_name(phone_e164: str) -> str:
    digits = "".join(ch for ch in phone_e164 if ch.isdigit())
    suffix = digits[-4:] if len(digits) >= 4 else digits
    return f"Seller {suffix}" if suffix else "Seller"

@router.post("/request-otp")
def request_otp(payload: OTPRequest):
    # MVP: no-op. In prod: send OTP using Twilio Verify or local SMS provider.
    return {"ok": True}

@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: OTPVerify, session: Session = Depends(get_session)):
    if payload.code != "0000":
        raise HTTPException(status_code=400, detail="Invalid code (MVP accepts 0000)")

    requested_name = (payload.name or "").strip()
    user = session.exec(select(User).where(User.phone_e164 == payload.phone_e164)).first()
    if not user:
        user = User(
            phone_e164=payload.phone_e164,
            role=UserRole.seller,
            name=requested_name or fallback_name(payload.phone_e164),
            verified_at=datetime.utcnow(),
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    else:
        if user.is_banned:
            raise HTTPException(status_code=403, detail="User is banned")
        if not user.verified_at:
            user.verified_at = datetime.utcnow()
        if requested_name:
            user.name = requested_name
        elif not user.name:
            user.name = fallback_name(payload.phone_e164)
        session.add(user)
        session.commit()
        session.refresh(user)

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)
