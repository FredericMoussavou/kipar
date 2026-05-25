import secrets
import string
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.totp_backup_code import TOTPBackupCode
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

BACKUP_CODE_COUNT = 8
BACKUP_CODE_LENGTH = 10


def _generate_raw_code() -> str:
    """Genere un code de secours format XXXXX-XXXXX."""
    chars = string.ascii_uppercase + string.digits
    part1 = "".join(secrets.choice(chars) for _ in range(5))
    part2 = "".join(secrets.choice(chars) for _ in range(5))
    return f"{part1}-{part2}"


async def generate_backup_codes(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    """Genere 8 codes de secours, les hashe et les sauvegarde en DB.
    Supprime les anciens codes non utilises avant de creer les nouveaux.
    Retourne les codes en clair (affichage unique).
    """
    # Supprimer les anciens codes non utilises
    existing = await db.execute(
        select(TOTPBackupCode).where(
            TOTPBackupCode.user_id == user_id,
            TOTPBackupCode.used_at.is_(None)
        )
    )
    for code in existing.scalars().all():
        await db.delete(code)

    raw_codes = []
    for _ in range(BACKUP_CODE_COUNT):
        raw = _generate_raw_code()
        raw_codes.append(raw)
        hashed = pwd_context.hash(raw.replace("-", "").upper())
        db.add(TOTPBackupCode(user_id=user_id, code_hash=hashed))

    await db.commit()
    return raw_codes


async def verify_backup_code(db: AsyncSession, user_id: uuid.UUID, code: str) -> bool:
    """Verifie un code de secours et le marque comme utilise si valide."""
    from datetime import datetime, timezone
    normalized = code.replace("-", "").replace(" ", "").upper()

    result = await db.execute(
        select(TOTPBackupCode).where(
            TOTPBackupCode.user_id == user_id,
            TOTPBackupCode.used_at.is_(None)
        )
    )
    codes = result.scalars().all()

    for backup_code in codes:
        if pwd_context.verify(normalized, backup_code.code_hash):
            backup_code.used_at = datetime.now(timezone.utc)
            await db.commit()
            return True

    return False
