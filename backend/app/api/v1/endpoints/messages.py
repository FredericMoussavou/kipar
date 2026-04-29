import re
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.message import Conversation, Message
from app.schemas.message import ConversationResponse, MessageResponse
from app.websockets.chat import manager

router = APIRouter(prefix="/conversations", tags=["messages"])

SENSITIVE_PATTERN = re.compile(
    r'[\w.+-]+@[\w-]+\.[\w.]+'
    r'|(\+?\d[\d\s\-().]{7,}\d)',
    re.IGNORECASE
)


def mask_sensitive(content: str) -> str:
    return SENSITIVE_PATTERN.sub("[masqué]", content)


@router.post("/{booking_id}", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    if booking.status != "accepted":
        raise HTTPException(status_code=400, detail="La réservation doit être acceptée")
    if current_user.id not in (booking.sender_id, booking.receiver_id):
        raise HTTPException(status_code=403, detail="Non autorisé")

    # Vérifie qu'une conversation n'existe pas déjà
    result = await db.execute(
        select(Conversation)
        .where(Conversation.booking_id == booking_id)
        .options(selectinload(Conversation.messages))
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()

    conversation = Conversation(
        booking_id=booking.id,
        sender_id=booking.sender_id,
        carrier_id=trip.carrier_id,
    )
    db.add(conversation)
    await db.flush()

    # Recharge avec les messages (vide pour l'instant)
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation.id)
        .options(selectinload(Conversation.messages))
    )
    return result.scalar_one()


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable")
    if current_user.id not in (conv.sender_id, conv.carrier_id):
        raise HTTPException(status_code=403, detail="Non autorisé")
    return conv


@router.websocket("/{conversation_id}/ws")
async def websocket_chat(
    conversation_id: str,
    websocket: WebSocket,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
    except Exception:
        await websocket.close(code=1008)
        return

    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv or str(user_id) not in (str(conv.sender_id), str(conv.carrier_id)):
        await websocket.close(code=1008)
        return

    await manager.connect(conversation_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            clean_content = mask_sensitive(data)

            msg = Message(
                conversation_id=conv.id,
                sender_id=user_id,
                content=clean_content,
            )
            db.add(msg)
            await db.flush()

            await manager.broadcast(conversation_id, {
                "id": str(msg.id),
                "sender_id": str(user_id),
                "content": clean_content,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            await db.commit()

    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)
