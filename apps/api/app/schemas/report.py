from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.report import ReportStatus, ReportType


class ListingReportCreate(BaseModel):
    reason: str = Field(min_length=2, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=1000)


class FalseBidReportCreate(BaseModel):
    reason: str = Field(min_length=2, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=1000)


class ReportUpdate(BaseModel):
    status: Optional[ReportStatus] = None
    admin_notes: Optional[str] = Field(default=None, max_length=1000)


class ReportOut(BaseModel):
    id: int
    report_type: ReportType
    status: ReportStatus
    car_id: int
    offer_id: Optional[int]
    reporter_user_id: int
    reported_user_id: Optional[int]
    reason: str
    notes: Optional[str]
    admin_notes: Optional[str]
    reviewed_by_id: Optional[int]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class AdminReportOut(ReportOut):
    listing_title: Optional[str] = None
    listing_vehicle: Optional[str] = None
    offer_amount: Optional[int] = None
    reporter_label: Optional[str] = None
    reported_user_label: Optional[str] = None
