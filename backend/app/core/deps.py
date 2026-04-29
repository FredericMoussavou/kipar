from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalide")
        user_id: str = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


async def get_verified_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Exige que le KYC soit vérifié."""
    if current_user.kyc_status != "verified":
        raise HTTPException(
            status_code=403,
            detail="Vérification KYC requise pour effectuer cette action"
        )
    return current_user
