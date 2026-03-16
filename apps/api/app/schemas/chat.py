from datetime import datetime
from pydantic import BaseModel


class ChatMessageCreate(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    id: int
    car_id: int
    sender_user_id: int
    message: str
    created_at: datetime
