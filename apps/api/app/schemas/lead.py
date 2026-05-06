from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LeadCreate(BaseModel):
    name: Optional[str] = None
    phone_e164: Optional[str] = None
    message: Optional[str] = None
    amount: Optional[int] = None
    channel: str = "form"


class LeadOut(BaseModel):
    id: int
    car_id: int
    owner_id: int
    buyer_user_id: Optional[int]
    name: Optional[str]
    phone_e164: Optional[str]
    message: Optional[str]
    amount: Optional[int]
    accepted_at: Optional[datetime]
    rejected_at: Optional[datetime] = None
    channel: str
    created_at: datetime


class OfferCreate(BaseModel):
    amount: int
    visibility: str = "public"


class OfferOut(BaseModel):
    id: int
    amount: int
    created_at: datetime
    accepted_at: Optional[datetime] = None
    visibility: str = "public"


class OfferSummaryOut(BaseModel):
    highest_offer: Optional[int]
    offer_count: int
    bidding_open: bool
    public_bidding_enabled: bool
    accepted_offer: Optional[OfferOut]
    offers: list[OfferOut]


class OwnerOfferOut(BaseModel):
    id: int
    amount: int
    created_at: datetime
    accepted_at: Optional[datetime] = None
    visibility: str = "public"
    buyer_user_id: Optional[int] = None
    buyer_user_label: Optional[str] = None
    phone_e164: Optional[str] = None
    false_bid_report_count: int = 0


class OwnerOfferSummaryOut(BaseModel):
    highest_offer: Optional[int]
    offer_count: int
    bidding_open: bool
    public_bidding_enabled: bool
    accepted_offer: Optional[OwnerOfferOut]
    offers: list[OwnerOfferOut]
