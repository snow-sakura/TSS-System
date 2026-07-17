"""
TSS AI测试平台 — 个人中心 API路由 (用户管理/角色/操作日志)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import hash_password
from backend.app.models.models import User, OperationLog
from backend.app.schemas.schemas import (
    UserOut, OperationLogOut, RegisterRequest,
    ApiResponse, PaginatedResponse,
)
from typing import Optional
from pydantic import BaseModel, Field


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

router = APIRouter(tags=["个人中心"])


# ============================================================
# 用户管理
# ============================================================

user_router = APIRouter(prefix="/users", tags=["用户管理"])


@user_router.get("", response_model=ApiResponse)
def list_users(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    total = q.count()
    items = q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=PaginatedResponse(
        items=[UserOut.model_validate(u).model_dump() for u in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))


@user_router.post("", response_model=ApiResponse)
def create_user(req: RegisterRequest, db: Session = Depends(get_db)):
    """管理员创建用户"""
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=409, detail="用户名已存在")
    user = User(
        username=req.username, email=req.email,
        hashed_password=hash_password(req.password),
        display_name=req.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return ApiResponse(code=201, data=UserOut.model_validate(user).model_dump())


@user_router.put("/{user_id}", response_model=ApiResponse)
def update_user(user_id: str, req: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    update_data = req.model_dump(exclude_none=True)
    if "password" in update_data:
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    for k, v in update_data.items():
        setattr(user, k, v)
    db.commit()
    return ApiResponse(data=UserOut.model_validate(user).model_dump())


@user_router.delete("/{user_id}", response_model=ApiResponse)
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    db.delete(user)
    db.commit()
    return ApiResponse(message="删除成功")


# ============================================================
# 操作日志
# ============================================================

log_router = APIRouter(prefix="/operation-logs", tags=["操作日志"])


@log_router.get("", response_model=ApiResponse)
def list_operation_logs(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    action: str = Query(None), resource_type: str = Query(None),
    user_id: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(OperationLog)
    if action:
        q = q.filter(OperationLog.action == action)
    if resource_type:
        q = q.filter(OperationLog.resource_type == resource_type)
    if user_id:
        q = q.filter(OperationLog.user_id == user_id)
    total = q.count()
    items = q.order_by(OperationLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=PaginatedResponse(
        items=[OperationLogOut.model_validate(o).model_dump() for o in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))
