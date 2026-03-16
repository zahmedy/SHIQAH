from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.db.session import get_session
from app.models.car import CarListing
from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageOut

router = APIRouter(tags=["chat"])


@router.get("/cars/{car_id}/chat", response_model=list[ChatMessageOut])
def list_chat_messages(
    car_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")

    messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.car_id == car_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
    ).all()
    return [ChatMessageOut(**msg.model_dump()) for msg in messages]


@router.post("/cars/{car_id}/chat", response_model=ChatMessageOut)
def create_chat_message(
    car_id: int,
    payload: ChatMessageCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
    if not car:
        raise HTTPException(status_code=404, detail="Not found")

    text = payload.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    message = ChatMessage(
        car_id=car_id,
        sender_user_id=user.id,
        message=text,
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    return ChatMessageOut(**message.model_dump())
