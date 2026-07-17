"""
TSS AI测试平台 — 认证模块 API路由
登录 / 注册 / 刷新Token / 验证码 / 个人资料
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import (
    hash_password, verify_password, create_token_pair, refresh_access_token,
    decode_token, CaptchaGenerator,
)
from backend.app.models.models import User, OperationLog
from backend.app.schemas.schemas import (
    LoginRequest, RegisterRequest, TokenResponse, RefreshRequest,
    CaptchaResponse, UserOut, ApiResponse,
)

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=ApiResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """用户登录"""
    # 查找用户
    user = db.query(User).filter(User.username == req.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if user.status == "locked":
        raise HTTPException(status_code=403, detail="账户已被锁定")

    # 验证密码
    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # 生成Token
    access_token, refresh_token = create_token_pair(user.id, user.username)

    # 更新最后登录时间
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # 记录操作日志
    log = OperationLog(
        user_id=user.id, username=user.username,
        action="login", resource_type="auth",
        ip_address=request.client.host if request.client else "",
        status="success",
    )
    db.add(log)
    db.commit()

    return ApiResponse(data=TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    ))


@router.post("/register", response_model=ApiResponse)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """用户注册"""
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="两次密码不一致")

    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=409, detail="用户名已存在")

    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=409, detail="邮箱已被注册")

    user = User(
        username=req.username,
        email=req.email,
        hashed_password=hash_password(req.password),
        display_name=req.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return ApiResponse(
        code=201,
        message="注册成功",
        data=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=ApiResponse)
def refresh(req: RefreshRequest):
    """刷新Token"""
    result = refresh_access_token(req.refresh_token)
    if not result:
        raise HTTPException(status_code=401, detail="Token无效或已过期")
    access_token, new_refresh_token = result
    return ApiResponse(data=TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    ))


@router.get("/captcha", response_model=ApiResponse)
def captcha():
    """获取验证码"""
    data = CaptchaGenerator.generate_math_captcha()
    return ApiResponse(data=CaptchaResponse(
        question=data["question"],
        token=data["token"],
    ))


@router.get("/profile", response_model=ApiResponse)
def profile(request: Request, db: Session = Depends(get_db)):
    """获取当前用户信息"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未认证")
    payload = decode_token(auth_header[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Token无效")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    return ApiResponse(data=UserOut.model_validate(user))
