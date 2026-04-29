from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.deps import get_current_user
from app.db.session import get_session
from app.models.user import User
from app.services.review import reindex_owner_active_listings
from app.services.user_identity import USER_ID_ERROR, ensure_user_id, is_user_id_taken, validate_user_id

router = APIRouter(prefix="/me", tags=["me"])


class MeUpdate(BaseModel):
    name: str | None = None
    user_id: str | None = None
    contact_text_enabled: bool | None = None
    contact_whatsapp_enabled: bool | None = None


def serialize_me(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "user_id": user.user_id,
        "phone_e164": user.phone_e164,
        "contact_text_enabled": user.contact_text_enabled,
        "contact_whatsapp_enabled": user.contact_whatsapp_enabled,
        "role": user.role,
        "verified_at": user.verified_at,
    }

@router.get("")
def me(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    if not user.user_id:
        ensure_user_id(session, user)
    return serialize_me(user)


@router.patch("")
def update_me(
    payload: MeUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if (
        payload.name is None
        and payload.user_id is None
        and payload.contact_text_enabled is None
        and payload.contact_whatsapp_enabled is None
    ):
        raise HTTPException(status_code=400, detail="At least one field is required")

    changed = False
    should_reindex = False

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name is required")
        should_reindex = True
        if name != user.name:
            user.name = name
            changed = True

    if payload.user_id is not None:
        try:
            public_user_id = validate_user_id(payload.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=USER_ID_ERROR)

        should_reindex = True
        if is_user_id_taken(session, public_user_id, exclude_user_id=user.id):
            raise HTTPException(status_code=409, detail="User ID is already taken")

        if public_user_id != user.user_id:
            user.user_id = public_user_id
            changed = True

    if payload.contact_text_enabled is not None and payload.contact_text_enabled != user.contact_text_enabled:
        user.contact_text_enabled = payload.contact_text_enabled
        changed = True

    if payload.contact_whatsapp_enabled is not None and payload.contact_whatsapp_enabled != user.contact_whatsapp_enabled:
        user.contact_whatsapp_enabled = payload.contact_whatsapp_enabled
        changed = True

    if changed:
        session.add(user)
        session.commit()
        session.refresh(user)

    if should_reindex and user.id is not None:
        reindex_owner_active_listings(session, user.id)

    return serialize_me(user)
