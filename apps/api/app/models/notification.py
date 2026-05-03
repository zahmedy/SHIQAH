from datetime import datetime
from typing import Optional

from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field


class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(index=True, foreign_key="user.id")
    actor_user_id: Optional[int] = Field(default=None, index=True, foreign_key="user.id")
    car_id: Optional[int] = Field(default=None, index=True, foreign_key="carlisting.id")

    type: str = Field(index=True)
    title: str
    body: str
    metadata_json: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))

    read_at: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
