from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class CarPhoto(BaseModel):
    id: int
    public_url: str
    sort_order: int
    is_cover: bool

class CarCreate(BaseModel):
    city: str
    district: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    make: str
    model: str
    year: int

    price_sar: Optional[int] = None
    mileage_km: Optional[int] = None

    body_type: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    drivetrain: Optional[str] = None
    condition: Optional[str] = None
    color: Optional[str] = None

    title_ar: Optional[str] = None
    description_ar: str


class CarUpdate(BaseModel):
    city: Optional[str] = None
    district: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None

    price_sar: Optional[int] = None
    mileage_km: Optional[int] = None

    body_type: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    drivetrain: Optional[str] = None
    condition: Optional[str] = None
    color: Optional[str] = None

    title_ar: Optional[str] = None
    description_ar: Optional[str] = None


class VinScanRequest(BaseModel):
    image_base64: str
    content_type: str = "image/jpeg"


class VinScanResponse(BaseModel):
    vin: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    body_type: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None
    drivetrain: Optional[str] = None
    message: Optional[str] = None


class CarOut(BaseModel):
    id: int
    status: str
    owner_id: int

    city: str
    district: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]

    make: str
    model: str
    year: int

    ml_status: Optional[str]
    ml_source: Optional[str]
    ml_make: Optional[str]
    ml_model: Optional[str]
    ml_year_start: Optional[int]
    ml_year_end: Optional[int]
    ml_confidence: Optional[float]
    ml_raw: Optional[str]
    ml_updated_at: Optional[datetime]

    price_sar: Optional[int]
    mileage_km: Optional[int]

    body_type: Optional[str]
    transmission: Optional[str]
    fuel_type: Optional[str]
    drivetrain: Optional[str]
    condition: Optional[str]
    color: Optional[str]
    photos: list[CarPhoto] = []

    title_ar: str
    description_ar: str

    published_at: Optional[datetime]
    reviewed_at: Optional[datetime]
    review_source: Optional[str]
    review_reason: Optional[str]
    created_at: datetime
    updated_at: datetime


class PublicSellerOut(BaseModel):
    id: Optional[int]
    name: Optional[str]
    user_id: Optional[str]
    phone_e164: Optional[str]


class PublicContactOut(BaseModel):
    whatsapp_url: Optional[str]
    call_phone_e164: Optional[str]


class PublicCarDetailOut(BaseModel):
    listing: CarOut
    seller: PublicSellerOut
    contact: PublicContactOut
