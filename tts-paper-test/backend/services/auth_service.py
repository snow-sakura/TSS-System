"""认证服务"""

from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User, Role
from core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from core.exceptions import AuthenticationError, NotFoundError


async def register_user(db: AsyncSession, username: str, email: str, password: str, display_name: str = None) -> User:
    """注册用户"""
    # 检查用户名是否已存在
    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalar_one_or_none():
        raise ValueError("用户名已存在")

    # 检查邮箱是否已存在
    existing_email = await db.execute(select(User).where(User.email == email))
    if existing_email.scalar_one_or_none():
        raise ValueError("邮箱已被注册")

    user = User(
        username=username,
        email=email,
        display_name=display_name or username,
        hashed_password=hash_password(password),
    )
    db.add(user)
    await db.flush()

    # 分配默认角色
    role_result = await db.execute(select(Role).where(Role.name == "user"))
    role = role_result.scalar_one_or_none()
    if role:
        user.roles.append(role)

    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, username: str, password: str) -> dict:
    """用户登录"""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise AuthenticationError("用户名或密码错误")

    if not user.is_active:
        raise AuthenticationError("账户已被禁用")

    # 更新最后登录时间
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    # 生成Token
    access_token = create_access_token(data={"sub": str(user.id), "username": user.username})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "username": user.username})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "is_superuser": user.is_superuser,
        },
    }


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> dict:
    """刷新Access Token"""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise AuthenticationError("无效的刷新Token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise AuthenticationError("用户不存在或已禁用")

    access_token = create_access_token(data={"sub": str(user.id), "username": user.username})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id), "username": user.username})

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


async def get_current_user(db: AsyncSession, user_id: int) -> User:
    """获取当前用户"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError("用户")
    return user
