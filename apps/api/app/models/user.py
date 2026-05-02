from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import SQLModel, Field


class UserRole(str, Enum):
    buyer = "buyer"
    seller = "seller"
    dealer = "dealer"
    admin = "admin"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    role: UserRole = Field(default=UserRole.buyer, index=True)
    name: Optional[str] = None
    user_id: Optional[str] = Field(default=None, index=True, unique=True)
    email: Optional[str] = Field(default=None, index=True, unique=True)
    phone_e164: Optional[str] = Field(default=None, index=True, unique=True)
    contact_text_enabled: bool = Field(default=False)
    contact_whatsapp_enabled: bool = Field(default=False)

    # For MVP: email verification uses a fixed code; later send real codes or use OAuth.
    is_banned: bool = Field(default=False, index=True)
    verified_at: Optional[datetime] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
