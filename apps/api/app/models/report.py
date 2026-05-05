from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class ReportType(str, Enum):
    listing = "listing"
    false_bid = "false_bid"


class ReportStatus(str, Enum):
    open = "open"
    reviewing = "reviewing"
    resolved = "resolved"
    dismissed = "dismissed"


class UserReport(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    report_type: ReportType = Field(index=True)
    status: ReportStatus = Field(default=ReportStatus.open, index=True)

    car_id: int = Field(index=True, foreign_key="carlisting.id")
    offer_id: Optional[int] = Field(default=None, index=True, foreign_key="lead.id")
    reporter_user_id: int = Field(index=True, foreign_key="user.id")
    reported_user_id: Optional[int] = Field(default=None, index=True, foreign_key="user.id")

    reason: str = Field(index=True)
    notes: Optional[str] = None
    admin_notes: Optional[str] = None
    reviewed_by_id: Optional[int] = Field(default=None, index=True, foreign_key="user.id")
    reviewed_at: Optional[datetime] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
