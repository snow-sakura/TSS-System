"""认证路由"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, UserResponse
from schemas.common import ResponseModel, TokenResponse
from services.auth_service import register_user, authenticate_user, refresh_access_token
from services.log_service import create_operation_log
from api.deps import get_current_user_dep
from models.user import User

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/register", response_model=ResponseModel)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="两次密码输入不一致")

    user = await register_user(
        db,
        username=body.username,
        email=body.email,
        password=body.password,
        display_name=body.display_name,
    )

    await create_operation_log(
        db, module="auth", action="register",
        user_id=user.id, username=user.username,
        detail={"email": user.email},
    )

    return ResponseModel(
        message="注册成功",
        data=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=ResponseModel)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    result = await authenticate_user(db, body.username, body.password)

    await create_operation_log(
        db, module="auth", action="login",
        user_id=result["user"]["id"], username=result["user"]["username"],
    )

    return ResponseModel(
        message="登录成功",
        data=result,
    )


@router.post("/refresh", response_model=ResponseModel)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """刷新Token"""
    result = await refresh_access_token(db, body.refresh_token)
    return ResponseModel(message="刷新成功", data=result)


@router.get("/profile", response_model=ResponseModel)
async def get_profile(user: User = Depends(get_current_user_dep)):
    """获取个人信息"""
    return ResponseModel(
        data=UserResponse.model_validate(user),
    )
