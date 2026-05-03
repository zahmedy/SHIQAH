from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    user_id: int
    actor_user_id: Optional[int]
    car_id: Optional[int]
    type: str
    title: str
    body: str
    metadata_json: dict | None = None
    read_at: Optional[datetime]
    created_at: datetime


class NotificationUnreadCountOut(BaseModel):
    unread_count: int
