from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LeadCreate(BaseModel):
    name: Optional[str] = None
    phone_e164: Optional[str] = None
    message: Optional[str] = None
    amount_sar: Optional[int] = None
    channel: str = "form"


class LeadOut(BaseModel):
    id: int
    car_id: int
    owner_id: int
    buyer_user_id: Optional[int]
    name: Optional[str]
    phone_e164: Optional[str]
    message: Optional[str]
    amount_sar: Optional[int]
    channel: str
    created_at: datetime


class OfferCreate(BaseModel):
    amount_sar: int
    phone_e164: Optional[str] = None
    message: Optional[str] = None


class OfferOut(BaseModel):
    id: int
    amount_sar: int
    created_at: datetime


class OfferSummaryOut(BaseModel):
    highest_offer_sar: Optional[int]
    offer_count: int
    offers: list[OfferOut]
