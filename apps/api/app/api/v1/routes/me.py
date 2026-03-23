from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.deps import get_current_user
from app.db.session import get_session
from app.models.user import User

router = APIRouter(prefix="/me", tags=["me"])


class MeUpdate(BaseModel):
    name: str

@router.get("")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "phone_e164": user.phone_e164,
        "role": user.role,
        "verified_at": user.verified_at,
    }


@router.patch("")
def update_me(
    payload: MeUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    user.name = name
    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "phone_e164": user.phone_e164,
        "role": user.role,
        "verified_at": user.verified_at,
    }
