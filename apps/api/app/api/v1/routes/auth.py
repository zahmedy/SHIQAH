from datetime import datetime, timedelta
import hashlib
import hmac
import json
import secrets
from urllib.parse import parse_qsl, urlencode, urlparse, urlsplit, urlunsplit
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlmodel import Session, select

from app.schemas.auth import EmailCodeRequest, EmailCodeVerify, OTPRequest, OTPRequestResponse, OTPVerify, TokenResponse
from app.core.config import settings
from app.db.session import get_session
from app.models.auth import EmailVerificationCode
from app.models.user import User, UserRole
from app.core.security import ALGORITHM, create_access_token
from app.services.email_delivery import send_email_code
from app.services.review import reindex_owner_active_listings
from app.services.user_identity import ensure_user_id

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPE = "openid email profile"
LOCAL_OAUTH_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0"}
EMAIL_LOGIN_PURPOSE = "email_login"


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


def _generate_email_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_email_code(email: str, code: str, purpose: str = EMAIL_LOGIN_PURPOSE) -> str:
    message = f"{purpose}:{email}:{code}".encode("utf-8")
    return hmac.new(settings.JWT_SECRET.encode("utf-8"), message, hashlib.sha256).hexdigest()


def _dev_code_response_value(code: str) -> str | None:
    return code if settings.ENV.lower() != "prod" and not settings.EMAIL_FROM else None


def _issue_token_for_email(session: Session, email: str, name: str | None = None) -> TokenResponse:
    normalized_email = normalize_email(email)
    requested_name = (name or "").strip()
    user = session.exec(select(User).where(User.email == normalized_email)).first()
    if not user:
        user = User(
            email=normalized_email,
            role=UserRole.seller,
            name=requested_name or fallback_email_name(normalized_email),
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
            user.name = fallback_email_name(normalized_email)
        session.add(user)
        session.commit()
        session.refresh(user)

    if not user.user_id:
        ensure_user_id(session, user)

    if user.name:
        reindex_owner_active_listings(session, user.id)

    return TokenResponse(access_token=create_access_token(subject=str(user.id)))


def _request_origin(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    return f"{proto}://{host.split(',')[0].strip()}"


def _is_local_url(value: str | None) -> bool:
    if not value:
        return False
    return urlparse(value).hostname in LOCAL_OAUTH_HOSTS


def _configured_or_request_url(
    configured_url: str | None,
    request: Request,
    path: str,
    local_fallback: str,
) -> str:
    origin = _request_origin(request).rstrip("/")
    origin_is_local = _is_local_url(origin)
    if configured_url and (origin_is_local or not _is_local_url(configured_url)):
        return configured_url
    if origin_is_local:
        return local_fallback
    return f"{origin}{path}"


def _google_redirect_uri(request: Request) -> str:
    return _configured_or_request_url(
        settings.GOOGLE_REDIRECT_URI,
        request,
        "/v1/auth/google/callback",
        "http://localhost:8000/v1/auth/google/callback",
    )


def _login_success_url(request: Request) -> str:
    return _configured_or_request_url(
        settings.GOOGLE_LOGIN_SUCCESS_URL,
        request,
        "/login",
        "http://localhost:3001/login",
    )


def _configured_google_success_urls(request: Request) -> set[str]:
    configured_urls = {
        url.strip()
        for url in settings.GOOGLE_ALLOWED_SUCCESS_URLS.split(",")
        if url.strip()
    }
    configured_urls.add(_login_success_url(request))
    return configured_urls


def _is_safe_local_next(value: str | None) -> bool:
    if not value or not value.startswith("/") or value.startswith("//"):
        return False
    parsed = urlparse(value)
    return not parsed.scheme and not parsed.netloc


def _is_login_success_url_with_safe_next(request: Request, success_url: str) -> bool:
    parsed = urlparse(success_url)
    login_url = urlparse(_login_success_url(request))
    if (parsed.scheme, parsed.netloc, parsed.path) != (login_url.scheme, login_url.netloc, login_url.path):
        return False

    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if not query:
        return True
    if set(query) != {"next"}:
        return False
    return _is_safe_local_next(query.get("next"))


def _validate_google_success_url(request: Request, success_url: str | None) -> str:
    if not success_url:
        return _login_success_url(request)
    if success_url in _configured_google_success_urls(request):
        return success_url
    if _is_login_success_url_with_safe_next(request, success_url):
        return success_url
    raise HTTPException(status_code=400, detail="Invalid Google auth callback URL")


def _safe_google_success_url(request: Request, success_url: str | None) -> str:
    try:
        return _validate_google_success_url(request, success_url)
    except HTTPException:
        return _login_success_url(request)


def _append_auth_result(success_url: str, key: str, value: str) -> str:
    parsed = urlsplit(success_url)
    if parsed.scheme in {"http", "https"}:
        fragment_params = parse_qsl(parsed.fragment, keep_blank_values=True)
        fragment_params.append((key, value))
        return urlunsplit(parsed._replace(fragment=urlencode(fragment_params)))

    query_params = parse_qsl(parsed.query, keep_blank_values=True)
    query_params.append((key, value))
    return urlunsplit(parsed._replace(query=urlencode(query_params)))


def _create_google_state(request: Request, success_url: str | None = None) -> str:
    payload = {
        "sub": "google_oauth_state",
        "success_url": _validate_google_success_url(request, success_url),
        "iat": int(datetime.utcnow().timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def _decode_google_state(state: str) -> str | None:
    try:
        payload = jwt.decode(state, settings.JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("sub") != "google_oauth_state":
        return None
    success_url = payload.get("success_url")
    return success_url if isinstance(success_url, str) else None


def _post_form_json(url: str, data: dict[str, str]) -> dict:
    encoded = urlencode(data).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Google token exchange failed: {detail}") from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Google token exchange failed") from exc


def _get_json(url: str, access_token: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Google profile lookup failed: {detail}") from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Google profile lookup failed") from exc


def _exchange_google_code(code: str, redirect_uri: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google login is not configured")
    return _post_form_json(
        GOOGLE_TOKEN_URL,
        {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
    )


def _fetch_google_userinfo(access_token: str) -> dict:
    return _get_json(GOOGLE_USERINFO_URL, access_token)


def require_us_phone(phone_e164: str) -> str:
    normalized = phone_e164.strip()
    if not normalized.startswith("+1") or len(normalized) != 12 or not normalized[1:].isdigit():
        raise HTTPException(status_code=400, detail="Only U.S. phone numbers are allowed")
    return normalized


@router.post("/request-email-code", response_model=OTPRequestResponse)
def request_email_code(payload: EmailCodeRequest, session: Session = Depends(get_session)):
    now = datetime.utcnow()
    email = normalize_email(payload.email)
    user = session.exec(select(User).where(User.email == email)).first()
    recent_codes = session.exec(
        select(EmailVerificationCode)
        .where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == EMAIL_LOGIN_PURPOSE,
            EmailVerificationCode.created_at >= now - timedelta(hours=1),
        )
        .order_by(EmailVerificationCode.created_at.desc())
    ).all()

    if recent_codes:
        seconds_since_last = (now - recent_codes[0].created_at).total_seconds()
        if seconds_since_last < settings.EMAIL_CODE_MIN_SECONDS_BETWEEN_REQUESTS:
            raise HTTPException(status_code=429, detail="Please wait before requesting another code")

    if len(recent_codes) >= settings.EMAIL_CODE_MAX_REQUESTS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many login code requests. Try again later")

    for active_code in session.exec(
        select(EmailVerificationCode).where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == EMAIL_LOGIN_PURPOSE,
            EmailVerificationCode.consumed_at == None,
        )
    ).all():
        active_code.consumed_at = now
        session.add(active_code)

    code = _generate_email_code()
    verification = EmailVerificationCode(
        email=email,
        purpose=EMAIL_LOGIN_PURPOSE,
        code_hash=_hash_email_code(email, code),
        expires_at=now + timedelta(minutes=settings.EMAIL_CODE_TTL_MINUTES),
    )
    session.add(verification)
    session.commit()

    try:
        send_email_code(email, code)
    except Exception as exc:
        verification.consumed_at = datetime.utcnow()
        session.add(verification)
        session.commit()
        raise HTTPException(status_code=502, detail="Failed to send verification email") from exc

    return {"ok": True, "needs_name": not user or not user.name, "dev_code": _dev_code_response_value(code)}


@router.post("/verify-email-code", response_model=TokenResponse)
def verify_email_code(payload: EmailCodeVerify, session: Session = Depends(get_session)):
    now = datetime.utcnow()
    email = normalize_email(payload.email)
    code = payload.code.strip()
    if not code.isdigit() or len(code) != 6:
        raise HTTPException(status_code=400, detail="Enter the 6-digit verification code")

    verification = session.exec(
        select(EmailVerificationCode)
        .where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == EMAIL_LOGIN_PURPOSE,
            EmailVerificationCode.consumed_at == None,
        )
        .order_by(EmailVerificationCode.created_at.desc())
    ).first()

    if not verification:
        raise HTTPException(status_code=400, detail="Request a new verification code")
    if verification.expires_at <= now:
        verification.consumed_at = now
        session.add(verification)
        session.commit()
        raise HTTPException(status_code=400, detail="Verification code expired")
    if verification.attempts >= settings.EMAIL_CODE_MAX_ATTEMPTS:
        verification.consumed_at = now
        session.add(verification)
        session.commit()
        raise HTTPException(status_code=429, detail="Too many verification attempts. Request a new code")

    verification.attempts += 1
    if not hmac.compare_digest(verification.code_hash, _hash_email_code(email, code)):
        session.add(verification)
        session.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code")

    verification.consumed_at = now
    session.add(verification)
    session.commit()

    return _issue_token_for_email(session, email, payload.name)


@router.get("/google/start")
def start_google_login(
    request: Request,
    success_url: str | None = None,
    callback_url: str | None = None,
):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google login is not configured")
    if success_url and callback_url and success_url != callback_url:
        raise HTTPException(status_code=400, detail="Conflicting Google auth callback URLs")

    requested_success_url = callback_url or success_url

    query = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": _google_redirect_uri(request),
        "response_type": "code",
        "scope": GOOGLE_SCOPE,
        "state": _create_google_state(request, requested_success_url),
        "prompt": "select_account",
    })
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{query}", status_code=302)


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    session: Session = Depends(get_session),
):
    success_url = _safe_google_success_url(request, _decode_google_state(state or ""))
    if error:
        return RedirectResponse(_append_auth_result(success_url, "auth_error", error), status_code=302)
    if not code:
        return RedirectResponse(_append_auth_result(success_url, "auth_error", "missing_code"), status_code=302)

    token_payload = _exchange_google_code(code, _google_redirect_uri(request))
    google_access_token = token_payload.get("access_token")
    if not google_access_token:
        return RedirectResponse(_append_auth_result(success_url, "auth_error", "missing_google_token"), status_code=302)

    profile = _fetch_google_userinfo(google_access_token)
    if not profile.get("email_verified", False):
        return RedirectResponse(_append_auth_result(success_url, "auth_error", "email_not_verified"), status_code=302)

    email = profile.get("email")
    if not email:
        return RedirectResponse(_append_auth_result(success_url, "auth_error", "missing_email"), status_code=302)

    name = profile.get("name") if isinstance(profile.get("name"), str) else None
    app_token = _issue_token_for_email(session, email, name).access_token
    return RedirectResponse(_append_auth_result(success_url, "access_token", app_token), status_code=302)

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
