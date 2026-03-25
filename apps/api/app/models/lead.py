from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class Lead(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    car_id: int = Field(index=True, foreign_key="carlisting.id")
    owner_id: int = Field(index=True, foreign_key="user.id")

    buyer_user_id: Optional[int] = Field(default=None, index=True, foreign_key="user.id")
    name: Optional[str] = None
    phone_e164: Optional[str] = Field(default=None, index=True)
    message: Optional[str] = None
    amount_sar: Optional[int] = Field(default=None, index=True)

    channel: str = Field(default="form", index=True)   # form / whatsapp / call
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
