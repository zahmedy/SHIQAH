from datetime import datetime
from pydantic import BaseModel


class ChatMessageCreate(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    id: int
    car_id: int
    sender_user_id: int
    sender_public_user_id: str | None = None
    message: str
    created_at: datetime
