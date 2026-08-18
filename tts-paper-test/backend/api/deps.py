"""API依赖注入"""

from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.security import decode_token
from models.user import User
from services.auth_service import get_current_user

security = HTTPBearer(auto_error=False)


async def get_current_user_dep(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """获取当前认证用户"""
    return await _resolve_user(credentials, db)


async def get_sse_user_dep(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """SSE 兼容认证：EventSource 无法携带 Authorization 头，优先从 query token 解析，回退 Bearer"""
    token = request.query_params.get("token")
    if token:
        resolved = await _decode_user(token, db)
        if resolved is not None:
            return resolved
    return await _resolve_user(credentials, db)


async def _resolve_user(
    credentials: Optional[HTTPAuthorizationCredentials],
    db: AsyncSession,
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证凭证",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await _decode_user(credentials.credentials, db)


async def _decode_user(token: str, db: AsyncSession) -> User:
    """解析 Bearer/query token 为当前用户"""
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或过期的Token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的Token载荷",
        )

    return await get_current_user(db, int(user_id))


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """可选的用户认证"""
    if not credentials:
        return None
    try:
        return await get_current_user_dep(credentials, db)
    except HTTPException:
        return None
