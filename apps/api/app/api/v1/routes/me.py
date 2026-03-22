from fastapi import APIRouter, Depends
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/me", tags=["me"])

@router.get("")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "phone_e164": user.phone_e164,
        "role": user.role,
        "verified_at": user.verified_at,
    }
