import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── SSE stream ──

async def notification_generator(user_id: str) -> AsyncGenerator[str, None]:
    """Génère un flux SSE : ping toutes les 15s + notifs non lues.
    Crée une nouvelle session DB à chaque poll pour éviter le cache de session.
    """
    last_check = datetime.now(timezone.utc)
    while True:
        await asyncio.sleep(15)
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Notification)
                    .where(Notification.user_id == uuid.UUID(user_id))
                    .where(Notification.is_read == False)
                    .where(Notification.created_at > last_check)
                    .order_by(Notification.created_at.desc())
                )
                notifs = result.scalars().all()
                last_check = datetime.now(timezone.utc)
                if notifs:
                    for n in notifs:
                        data = json.dumps({
                            "id": str(n.id),
                            "type": n.type,
                            "title": n.title,
                            "body": n.body,
                            "link": n.link,
                            "created_at": n.created_at.isoformat(),
                        })
                        yield f"data: {data}\n\n"
                else:
                    yield f"data: ping\n\n"
        except asyncio.CancelledError:
            break
        except Exception:
            yield f"data: ping\n\n"


@router.get("/stream")
async def stream_notifications(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """SSE — connexion persistante. Token via query param (SSE ne supporte pas les headers)."""
    try:
        payload = decode_token(token)
    except Exception:
        payload = None
    if not payload:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")

    return StreamingResponse(
        notification_generator(user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── CRUD ──

@router.get("")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste les 50 dernières notifs de l'utilisateur."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifs = result.scalars().all()
    unread_count = sum(1 for n in notifs if not n.is_read)
    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ],
    }


@router.patch("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marque toutes les notifs comme lues."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .where(Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.patch("/{notif_id}/read")
async def mark_as_read(
    notif_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marque une notif comme lue."""
    await db.execute(
        update(Notification)
        .where(Notification.id == notif_id)
        .where(Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.delete('/read')
async def delete_read_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supprime toutes les notifications lues."""
    from sqlalchemy import delete
    await db.execute(
        delete(Notification)
        .where(Notification.user_id == current_user.id)
        .where(Notification.is_read == True)
    )
    await db.commit()
    return {"ok": True}


@router.delete('/{notif_id}')
async def delete_notification(
    notif_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supprime une notification individuelle."""
    from sqlalchemy import delete
    await db.execute(
        delete(Notification)
        .where(Notification.id == notif_id)
        .where(Notification.user_id == current_user.id)
    )
    await db.commit()
    return {"ok": True}
