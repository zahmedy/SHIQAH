from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import SQLModel, Field


class CarStatus(str, Enum):
    draft = "draft"
    pending_review = "pending_review"
    active = "active"
    sold = "sold"
    rejected = "rejected"
    expired = "expired"

class CarMedia(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    car_id: int = Field(index=True, foreign_key="carlisting.id")

    storage_key: str = Field(index=True)
    public_url: str
    sort_order: int = Field(default=0, index=True)
    is_cover: bool = Field(default=False, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

class CarListing(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    owner_id: int = Field(index=True, foreign_key="user.id")
    status: CarStatus = Field(default=CarStatus.draft, index=True)

    # MVP: keep location simple
    city: str = Field(index=True)                 # "Dammam" / "Khobar"
    district: Optional[str] = Field(default=None, index=True)
    latitude: Optional[float] = Field(default=None, index=True)
    longitude: Optional[float] = Field(default=None, index=True)

    # MVP: use free text for make/model (seed tables later)
    make: str = Field(index=True)                 # "Toyota"
    model: str = Field(index=True)                # "Camry"
    year: int = Field(index=True)

    price_sar: int = Field(index=True)
    mileage_km: Optional[int] = Field(default=None, index=True)

    body_type: Optional[str] = Field(default=None, index=True)      # sedan/suv/pickup
    transmission: Optional[str] = Field(default=None, index=True)   # automatic/manual
    fuel_type: Optional[str] = Field(default=None, index=True)      # petrol/hybrid/...
    drivetrain: Optional[str] = Field(default=None, index=True)     # fwd/rwd/awd
    condition: Optional[str] = Field(default=None, index=True)      # used/new

    color: Optional[str] = Field(default=None, index=True)

    title_ar: str
    description_ar: str

    published_at: Optional[datetime] = Field(default=None, index=True)
    reviewed_at: Optional[datetime] = Field(default=None, index=True)
    review_source: Optional[str] = Field(default=None)
    review_reason: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
