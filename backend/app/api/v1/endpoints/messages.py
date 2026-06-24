import re
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.core.security import decode_token
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.message import Conversation, Message
from app.schemas.message import ConversationResponse, MessageCreate
from app.websockets.chat import manager
from app.services.translation_service import translate_message
from app.services.notif_db_service import notify_new_message_db
from app.i18n.loader import t

router = APIRouter(prefix="/conversations", tags=["messages"])


async def enrich_conversation(conv, db: AsyncSession) -> dict:
    booking_result = await db.execute(
        select(Booking)
        .options(joinedload(Booking.receiver))
        .where(Booking.id == conv.booking_id)
    )
    booking = booking_result.scalar_one_or_none()
    receiver_id = booking.receiver_id if booking else None

    user_ids = [uid for uid in [conv.sender_id, conv.carrier_id, receiver_id] if uid]
    users_dict = {}
    if user_ids:
        r = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_dict = {u.id: u for u in r.scalars().all()}

    sender = users_dict.get(conv.sender_id)
    carrier = users_dict.get(conv.carrier_id)
    receiver = users_dict.get(receiver_id) if receiver_id else None

    return {
        "id": conv.id,
        "booking_id": conv.booking_id,
        "sender_id": conv.sender_id,
        "carrier_id": conv.carrier_id,
        "receiver_id": receiver_id,
        "sender_first_name": sender.first_name if sender else None,
        "carrier_first_name": carrier.first_name if carrier else None,
        "receiver_first_name": receiver.first_name if receiver else None,
        "created_at": conv.created_at,
        "messages": conv.messages,
    }

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
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    WRITABLE_STATUSES = ("accepted", "paid", "in_transit")
    READONLY_STATUSES = ("delivered", "refused", "cancelled")
    if booking.status not in WRITABLE_STATUSES + READONLY_STATUSES:
        raise HTTPException(status_code=400, detail=t("errors.conversation_booking_not_accepted", lang))

    result_trip = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip_for_check = result_trip.scalar_one_or_none()
    carrier_id_for_check = trip_for_check.carrier_id if trip_for_check else None

    allowed = [booking.sender_id, booking.receiver_id, carrier_id_for_check]
    if current_user.id not in allowed:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    result = await db.execute(
        select(Conversation)
        .where(Conversation.booking_id == booking_id)
        .options(selectinload(Conversation.messages))
    )
    existing = result.scalar_one_or_none()
    if existing:
        return await enrich_conversation(existing, db)

    conversation = Conversation(
        booking_id=booking.id,
        sender_id=booking.sender_id,
        carrier_id=carrier_id_for_check,
    )
    db.add(conversation)
    await db.flush()

    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation.id)
        .options(selectinload(Conversation.messages))
    )
    fresh = result.scalar_one()
    return await enrich_conversation(fresh, db)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail=t("errors.conversation_not_found", lang))
    booking_result = await db.execute(select(Booking).where(Booking.id == conv.booking_id))
    booking_for_access = booking_result.scalar_one_or_none()
    receiver_id_for_access = booking_for_access.receiver_id if booking_for_access else None
    allowed_get = [conv.sender_id, conv.carrier_id, receiver_id_for_access]
    if current_user.id not in allowed_get:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    return await enrich_conversation(conv, db)


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
    if not conv:
        await websocket.close(code=1008)
        return

    booking_ws_result = await db.execute(select(Booking).where(Booking.id == conv.booking_id))
    booking_ws = booking_ws_result.scalar_one_or_none()
    receiver_id_ws = booking_ws.receiver_id if booking_ws else None
    allowed_ws = [str(conv.sender_id), str(conv.carrier_id), str(receiver_id_ws)]
    if str(user_id) not in allowed_ws:
        await websocket.close(code=1008)
        return

    READONLY_WS = ("delivered", "refused", "cancelled")
    is_readonly = booking_ws and booking_ws.status in READONLY_WS

    # OPTIMISATION PERFORMANCE : Chargement BATCH unique des langues
    participant_ids = [uid for uid in [conv.sender_id, conv.carrier_id, receiver_id_ws] if uid]
    p_res = await db.execute(select(User).where(User.id.in_(participant_ids)))
    participants_map = {u.id: u for u in p_res.scalars().all()}

    sender = participants_map.get(conv.sender_id)
    carrier = participants_map.get(conv.carrier_id)

    await manager.connect(conversation_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if is_readonly:
                await websocket.send_json({"error": "conversation_readonly"})
                continue
            clean_content = mask_sensitive(data)

            is_sender = str(user_id) == str(conv.sender_id)
            is_carrier = str(user_id) == str(conv.carrier_id)
            if is_sender:
                recipient = carrier
            elif is_carrier:
                recipient = sender
            else:
                recipient = sender
                
            recipient_lang = recipient.language if recipient else "fr"
            sender_user = sender if is_sender else carrier
            sender_lang = sender_user.language if sender_user else "fr"

            translated_content = None
            if sender_lang != recipient_lang:
                translated_content = await translate_message(clean_content, recipient_lang)

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
                "translated_content": translated_content,
                "sender_lang": sender_lang,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

            sender_display = sender_user.first_name if sender_user else "Quelqu'un"
            recipients = [conv.sender_id, conv.carrier_id, receiver_id_ws]
            
            for rid in recipients:
                if rid and str(rid) != str(user_id):
                    recipient_user = participants_map.get(rid)
                    r_lang = recipient_user.language if recipient_user else "fr"
                    
                    await notify_new_message_db(
                        db=db,
                        recipient_id=rid,
                        sender_name=sender_display,
                        excerpt=clean_content,
                        booking_id=booking_ws.id,
                        lang=r_lang,
                    )
            await db.commit()

    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)
