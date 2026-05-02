from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.schemas.auth import EmailCodeRequest, EmailCodeVerify, OTPRequest, OTPRequestResponse, OTPVerify, TokenResponse
from app.db.session import get_session
from app.models.user import User, UserRole
from app.core.security import create_access_token
from app.services.review import reindex_owner_active_listings
from app.services.user_identity import ensure_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


def fallback_name(phone_e164: str) -> str:
    digits = "".join(ch for ch in phone_e164 if ch.isdigit())
    suffix = digits[-4:] if len(digits) >= 4 else digits
    return f"Seller {suffix}" if suffix else "Seller"


def fallback_email_name(email: str) -> str:
    local_part = email.split("@", 1)[0].strip()
    return local_part[:32] or "Seller"


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return normalized


def require_us_phone(phone_e164: str) -> str:
    normalized = phone_e164.strip()
    if not normalized.startswith("+1") or len(normalized) != 12 or not normalized[1:].isdigit():
        raise HTTPException(status_code=400, detail="Only U.S. phone numbers are allowed")
    return normalized


@router.post("/request-email-code", response_model=OTPRequestResponse)
def request_email_code(payload: EmailCodeRequest, session: Session = Depends(get_session)):
    # MVP: no-op. In prod: send a magic link or email verification code.
    email = normalize_email(payload.email)
    user = session.exec(select(User).where(User.email == email)).first()
    return {"ok": True, "needs_name": not user or not user.name}


@router.post("/verify-email-code", response_model=TokenResponse)
def verify_email_code(payload: EmailCodeVerify, session: Session = Depends(get_session)):
    if payload.code != "0000":
        raise HTTPException(status_code=400, detail="Invalid code (MVP accepts 0000)")

    email = normalize_email(payload.email)
    requested_name = (payload.name or "").strip()
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        user = User(
            email=email,
            role=UserRole.seller,
            name=requested_name or fallback_email_name(email),
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
            user.name = fallback_email_name(email)
        session.add(user)
        session.commit()
        session.refresh(user)

    if not user.user_id:
        ensure_user_id(session, user)

    if user.name:
        reindex_owner_active_listings(session, user.id)

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)

@router.post("/request-otp", response_model=OTPRequestResponse)
def request_otp(payload: OTPRequest, session: Session = Depends(get_session)):
    # MVP: no-op. In prod: send OTP using Twilio Verify or local SMS provider.
    phone_e164 = require_us_phone(payload.phone_e164)
    user = session.exec(select(User).where(User.phone_e164 == phone_e164)).first()
    return {"ok": True, "needs_name": not user or not user.name}

@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: OTPVerify, session: Session = Depends(get_session)):
    if payload.code != "0000":
        raise HTTPException(status_code=400, detail="Invalid code (MVP accepts 0000)")

    phone_e164 = require_us_phone(payload.phone_e164)
    requested_name = (payload.name or "").strip()
    user = session.exec(select(User).where(User.phone_e164 == phone_e164)).first()
    if not user:
        user = User(
            phone_e164=phone_e164,
            role=UserRole.seller,
            name=requested_name or fallback_name(phone_e164),
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
            user.name = fallback_name(phone_e164)
        session.add(user)
        session.commit()
        session.refresh(user)

    if not user.user_id:
        ensure_user_id(session, user)

    if user.name:
        reindex_owner_active_listings(session, user.id)

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)
