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
    city: str = Field(index=True)                 # "Dallas" / "Seattle"
    district: Optional[str] = Field(default=None, index=True)
    latitude: Optional[float] = Field(default=None, index=True)
    longitude: Optional[float] = Field(default=None, index=True)

    # MVP: use free text for make/model (seed tables later)
    make: str = Field(index=True)                 # "Toyota"
    model: str = Field(index=True)                # "Camry"
    year: int = Field(index=True)

    # ML suggestions are stored separately so model output never overwrites
    # the user-confirmed listing fields.
    ml_status: Optional[str] = Field(default=None, index=True)      # queued/running/completed/failed
    ml_source: Optional[str] = Field(default=None)                  # model/service identifier
    ml_make: Optional[str] = Field(default=None)
    ml_model: Optional[str] = Field(default=None)
    ml_year_start: Optional[int] = Field(default=None)
    ml_year_end: Optional[int] = Field(default=None)
    ml_confidence: Optional[float] = Field(default=None)
    ml_raw: Optional[str] = Field(default=None)                     # raw JSON/string payload for debugging
    ml_updated_at: Optional[datetime] = Field(default=None, index=True)

    price: Optional[int] = Field(default=None, index=True)
    sold_price: Optional[int] = Field(default=None, index=True)
    mileage: Optional[int] = Field(default=None, index=True)

    body_type: Optional[str] = Field(default=None, index=True)      # sedan/suv/pickup
    transmission: Optional[str] = Field(default=None, index=True)   # automatic/manual
    fuel_type: Optional[str] = Field(default=None, index=True)      # petrol/hybrid/...
    drivetrain: Optional[str] = Field(default=None, index=True)     # fwd/rwd/awd
    engine_cylinders: Optional[int] = Field(default=None)
    engine_volume: Optional[float] = Field(default=None)
    condition: Optional[str] = Field(default=None, index=True)      # used/new

    color: Optional[str] = Field(default=None, index=True)

    title_ar: str
    description_ar: str
    public_bidding_enabled: bool = Field(default=False, index=True)

    published_at: Optional[datetime] = Field(default=None, index=True)
    sold_at: Optional[datetime] = Field(default=None, index=True)
    archived_at: Optional[datetime] = Field(default=None, index=True)
    status_before_archive: Optional[str] = Field(default=None, index=True)
    reviewed_at: Optional[datetime] = Field(default=None, index=True)
    review_source: Optional[str] = Field(default=None)
    review_reason: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
