from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    car_id: int = Field(index=True, foreign_key="carlisting.id")
    sender_user_id: int = Field(index=True, foreign_key="user.id")

    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
