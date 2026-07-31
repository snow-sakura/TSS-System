"""角色管理路由 - 完整CRUD"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.user import User, Role, UserRole
from schemas.common import ResponseModel
from api.deps import get_current_user_dep

router = APIRouter(prefix="/roles", tags=["角色管理"])


# ============================
# Schemas
# ============================

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: Optional[list[str]] = None

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[str]] = None

class RoleResponseItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: list[str] = []
    user_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ============================
# 角色 CRUD
# ============================

@router.get("", response_model=ResponseModel)
async def list_roles(
    page: int = 1,
    page_size: int = 20,
    search: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """角色列表（分页）"""
    query = select(Role)
    count_query = select(func.count(Role.id))

    if search:
        query = query.where(or_(
            Role.name.contains(search),
            Role.description.contains(search) if hasattr(Role, 'description') else None
        ))
        count_query = count_query.where(or_(
            Role.name.contains(search),
            Role.description.contains(search) if hasattr(Role, 'description') else None
        ))

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(Role.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    roles = (await db.execute(query)).scalars().all()

    # 获取每个角色的用户数
    result_items = []
    for role in roles:
        user_count_query = select(func.count(UserRole.id)).where(UserRole.role_id == role.id)
        user_count = (await db.execute(user_count_query)).scalar() or 0
        result_items.append({
            "id": role.id,
            "name": role.name,
            "description": role.description if hasattr(role, 'description') else None,
            "permissions": [],
            "user_count": user_count,
            "created_at": role.created_at,
            "updated_at": role.updated_at,
        })

    return ResponseModel(data={
        "items": result_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    })


@router.get("/all", response_model=ResponseModel)
async def list_all_roles(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """获取所有角色（不分页，用于下拉选择）"""
    result = await db.execute(select(Role).order_by(Role.name))
    roles = result.scalars().all()
    
    items = []
    for role in roles:
        user_count_query = select(func.count(UserRole.id)).where(UserRole.role_id == role.id)
        user_count = (await db.execute(user_count_query)).scalar() or 0
        items.append({
            "id": role.id,
            "name": role.name,
            "description": role.description if hasattr(role, 'description') else None,
            "permissions": [],
            "user_count": user_count,
        })
    
    return ResponseModel(data=items)


@router.get("/{role_id}", response_model=ResponseModel)
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """获取角色详情"""
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
    if not role:
        return ResponseModel(success=False, message="角色不存在")
    
    user_count_query = select(func.count(UserRole.id)).where(UserRole.role_id == role.id)
    user_count = (await db.execute(user_count_query)).scalar() or 0
    
    return ResponseModel(data={
        "id": role.id,
        "name": role.name,
        "description": role.description if hasattr(role, 'description') else None,
        "permissions": [],
        "user_count": user_count,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
    })


@router.post("", response_model=ResponseModel)
async def create_role(
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """创建角色"""
    # 检查角色名是否已存在
    existing = (await db.execute(select(Role).where(Role.name == data.name))).scalar_one_or_none()
    if existing:
        return ResponseModel(success=False, message="角色名已存在")

    role = Role(
        name=data.name,
        description=data.description,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    
    return ResponseModel(message="角色创建成功", data={
        "id": role.id,
        "name": role.name,
        "description": role.description if hasattr(role, 'description') else None,
    })


@router.put("/{role_id}", response_model=ResponseModel)
async def update_role(
    role_id: int,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新角色"""
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
    if not role:
        return ResponseModel(success=False, message="角色不存在")
    
    # 检查角色名是否已被其他角色使用
    if data.name and data.name != role.name:
        existing = (await db.execute(select(Role).where(Role.name == data.name, Role.id != role_id))).scalar_one_or_none()
        if existing:
            return ResponseModel(success=False, message="角色名已存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(role, key):
            setattr(role, key, value)
    role.updated_at = datetime.now()
    await db.commit()
    await db.refresh(role)
    
    return ResponseModel(message="角色更新成功", data={
        "id": role.id,
        "name": role.name,
        "description": role.description if hasattr(role, 'description') else None,
    })


@router.delete("/{role_id}", response_model=ResponseModel)
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除角色"""
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
    if not role:
        return ResponseModel(success=False, message="角色不存在")
    
    # 检查是否有用户使用该角色
    user_count = (await db.execute(select(func.count(UserRole.id)).where(UserRole.role_id == role_id))).scalar() or 0
    if user_count > 0:
        return ResponseModel(success=False, message=f"该角色已分配给 {user_count} 个用户，无法删除")
    
    # 删除关联记录
    await db.execute(delete(UserRole).where(UserRole.role_id == role_id))
    await db.delete(role)
    await db.commit()
    
    return ResponseModel(message="角色已删除")


@router.post("/batch-delete", response_model=ResponseModel)
async def batch_delete_roles(
    ids: list[int],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """批量删除角色"""
    count = 0
    for role_id in ids:
        role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
        if role:
            user_count = (await db.execute(select(func.count(UserRole.id)).where(UserRole.role_id == role_id))).scalar() or 0
            if user_count == 0:
                await db.execute(delete(UserRole).where(UserRole.role_id == role_id))
                await db.delete(role)
                count += 1
    await db.commit()
    
    return ResponseModel(message=f"已删除 {count} 个角色")
