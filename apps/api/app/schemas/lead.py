from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LeadCreate(BaseModel):
    name: Optional[str] = None
    phone_e164: Optional[str] = None
    message: Optional[str] = None
    channel: str = "form"


class LeadOut(BaseModel):
    id: int
    car_id: int
    owner_id: int
    buyer_user_id: Optional[int]
    name: Optional[str]
    phone_e164: Optional[str]
    message: Optional[str]
    channel: str
    created_at: datetime