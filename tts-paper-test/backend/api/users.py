"""用户管理路由 - 完整CRUD + 角色 + 登录日志"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.user import User, Role, UserRole
from models.operation_log import OperationLog
from models.device import UserDevice
from schemas.common import ResponseModel
from api.deps import get_current_user_dep

router = APIRouter(prefix="/users", tags=["用户管理"])


# ============================
# Schemas
# ============================

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    display_name: Optional[str] = None
    role: Optional[str] = "viewer"

class UserUpdate(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class UserResponseItem(BaseModel):
    id: int
    username: str
    email: str
    display_name: Optional[str] = None
    role: str = "viewer"
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, user: User) -> "UserResponseItem":
        """从 User ORM 模型构建响应（处理字段映射）"""
        role_name = "viewer"
        if user.roles and len(user.roles) > 0:
            role_name = user.roles[0].name
        return cls(
            id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            role=role_name,
            status="active" if user.is_active else "inactive",
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login,
        )

class LoginLogResponse(BaseModel):
    id: int
    user_id: int
    username: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str = "success"
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ============================
# 用户 CRUD
# ============================

@router.get("", response_model=ResponseModel)
async def list_users(
    page: int = 1, page_size: int = 20, search: str = None,
    role: str = None, status: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """用户列表（分页）"""
    query = select(User)
    count_query = select(func.count(User.id))

    if search:
        query = query.where(or_(User.username.contains(search), User.email.contains(search), User.display_name.contains(search)))
        count_query = count_query.where(or_(User.username.contains(search), User.email.contains(search), User.display_name.contains(search)))
    if role:
        query = query.join(UserRole).join(Role).where(Role.name == role)
        count_query = count_query.join(UserRole).join(Role).where(Role.name == role)
    if status == "active":
        query = query.where(User.is_active == True)
        count_query = count_query.where(User.is_active == True)
    elif status == "inactive":
        query = query.where(User.is_active == False)
        count_query = count_query.where(User.is_active == False)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    users = (await db.execute(query)).scalars().all()

    return ResponseModel(data={
        "items": [UserResponseItem.from_orm_model(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    })


@router.get("/all", response_model=ResponseModel)
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """获取所有用户（不分页，用于下拉选择）"""
    result = await db.execute(select(User).order_by(User.username))
    users = result.scalars().all()
    return ResponseModel(data=[UserResponseItem.from_orm_model(u) for u in users])


# ── 登录日志（放在 /{user_id} 之前以避免路由冲突）──

@router.get("/login-logs", response_model=ResponseModel)
async def list_login_logs(
    page: int = 1, page_size: int = 20, search: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """登录日志列表"""
    query = select(OperationLog).where(OperationLog.action == "login")
    count_query = select(func.count(OperationLog.id)).where(OperationLog.action == "login")

    if search:
        query = query.where(OperationLog.detail.contains(search))
        count_query = count_query.where(OperationLog.detail.contains(search))

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(OperationLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    logs = (await db.execute(query)).scalars().all()

    items = []
    for log in logs:
        items.append({
            "id": log.id,
            "user_id": log.user_id or 0,
            "username": log.username or "unknown",
            "ip_address": log.ip_address,
            "user_agent": "",
            "status": "success",
            "created_at": log.created_at,
        })

    return ResponseModel(data={
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    })


# ── 角色管理（放在 /{user_id} 之前以避免路由冲突）──

class RoleCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    permissions: Optional[list[str]] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[str]] = None


ROLES = [
    {"key": "admin", "name": "管理员", "description": "拥有所有权限", "permissions": ["*"]},
    {"key": "tester", "name": "测试工程师", "description": "测试相关权限", "permissions": ["read", "write", "execute"]},
    {"key": "developer", "name": "开发工程师", "description": "开发相关权限", "permissions": ["read", "write"]},
    {"key": "viewer", "name": "观察者", "description": "只读权限", "permissions": ["read"]},
]


@router.get("/roles/list", response_model=ResponseModel)
async def list_roles(user: User = Depends(get_current_user_dep)):
    """获取角色列表"""
    return ResponseModel(data=ROLES)


@router.get("/roles/stats", response_model=ResponseModel)
async def get_role_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """获取角色统计"""
    from sqlalchemy import text
    sql = text("""
        SELECT r.name, COUNT(ur.user_id) as cnt
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id
        GROUP BY r.id, r.name
    """)
    result = await db.execute(sql)
    stats = {row[0]: row[1] for row in result.all()}
    return ResponseModel(data=stats)


@router.post("/roles", response_model=ResponseModel)
async def create_role(data: RoleCreate, user: User = Depends(get_current_user_dep)):
    """创建角色"""
    if any(r["key"] == data.code for r in ROLES):
        return ResponseModel(success=False, message="角色编码已存在")
    ROLES.append({
        "key": data.code,
        "name": data.name,
        "description": data.description or "",
        "permissions": data.permissions or ["read"],
    })
    return ResponseModel(message="角色创建成功")


@router.put("/roles/{role_key}", response_model=ResponseModel)
async def update_role(role_key: str, data: RoleUpdate, user: User = Depends(get_current_user_dep)):
    """更新角色"""
    for r in ROLES:
        if r["key"] == role_key:
            if data.name is not None:
                r["name"] = data.name
            if data.description is not None:
                r["description"] = data.description
            if data.permissions is not None:
                r["permissions"] = data.permissions
            return ResponseModel(message="角色更新成功")
    return ResponseModel(success=False, message="角色不存在")


@router.delete("/roles/{role_key}", response_model=ResponseModel)
async def delete_role(role_key: str, user: User = Depends(get_current_user_dep)):
    """删除角色"""
    if role_key == "admin":
        return ResponseModel(success=False, message="管理员角色不可删除")
    for i, r in enumerate(ROLES):
        if r["key"] == role_key:
            ROLES.pop(i)
            return ResponseModel(message="角色已删除")
    return ResponseModel(success=False, message="角色不存在")


# ── 设备管理（放在 /{user_id} 之前以避免路由冲突）──

class DeviceResponse(BaseModel):
    id: int
    user_id: int
    username: str
    device_name: str
    os: Optional[str] = None
    browser: Optional[str] = None
    ip_address: Optional[str] = None
    fingerprint: Optional[str] = None
    status: str = "未验证"
    last_active_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DeviceStatusUpdate(BaseModel):
    status: str


@router.get("/devices", response_model=ResponseModel)
async def list_devices(
    page: int = 1, page_size: int = 20, search: str = None,
    status: str = None, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """设备列表（分页）"""
    query = select(UserDevice)
    count_query = select(func.count(UserDevice.id))

    if search:
        query = query.where(or_(
            UserDevice.device_name.contains(search),
            UserDevice.username.contains(search),
            UserDevice.fingerprint.contains(search),
        ))
        count_query = count_query.where(or_(
            UserDevice.device_name.contains(search),
            UserDevice.username.contains(search),
            UserDevice.fingerprint.contains(search),
        ))
    if status:
        query = query.where(UserDevice.status == status)
        count_query = count_query.where(UserDevice.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(UserDevice.last_active_at.desc().nullslast()).offset((page - 1) * page_size).limit(page_size)
    devices = (await db.execute(query)).scalars().all()

    return ResponseModel(data={
        "items": [DeviceResponse.model_validate(d) for d in devices],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    })


@router.get("/devices/{device_id}", response_model=ResponseModel)
async def get_device(
    device_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """获取设备详情"""
    device = (await db.execute(select(UserDevice).where(UserDevice.id == device_id))).scalar_one_or_none()
    if not device:
        return ResponseModel(success=False, message="设备不存在")
    return ResponseModel(data=DeviceResponse.model_validate(device))


@router.put("/devices/{device_id}/status", response_model=ResponseModel)
async def update_device_status(
    device_id: int, data: DeviceStatusUpdate, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新设备状态"""
    device = (await db.execute(select(UserDevice).where(UserDevice.id == device_id))).scalar_one_or_none()
    if not device:
        return ResponseModel(success=False, message="设备不存在")
    device.status = data.status
    device.updated_at = datetime.now()
    await db.commit()
    return ResponseModel(message="设备状态已更新")


@router.delete("/devices/{device_id}", response_model=ResponseModel)
async def delete_device(
    device_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除设备"""
    device = (await db.execute(select(UserDevice).where(UserDevice.id == device_id))).scalar_one_or_none()
    if not device:
        return ResponseModel(success=False, message="设备不存在")
    await db.delete(device)
    await db.commit()
    return ResponseModel(message="设备已删除")


# ── 用户 CRUD（参数化路由放在最后）──

@router.get("/{user_id}", response_model=ResponseModel)
async def get_user(
    user_id: int, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """获取用户详情"""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        return ResponseModel(success=False, message="用户不存在")
    return ResponseModel(data=UserResponseItem.from_orm_model(user))


@router.post("", response_model=ResponseModel)
async def create_user(
    data: UserCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """创建用户"""
    # 检查用户名是否已存在
    existing = (await db.execute(select(User).where(User.username == data.username))).scalar_one_or_none()
    if existing:
        return ResponseModel(success=False, message="用户名已存在")

    from passlib.hash import bcrypt
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=bcrypt.hash(data.password),
        display_name=data.display_name or data.username,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 分配角色
    role_name = data.role or "viewer"
    role = (await db.execute(select(Role).where(Role.name == role_name))).scalar_one_or_none()
    if role:
        user_role = UserRole(user_id=user.id, role_id=role.id)
        db.add(user_role)
        await db.commit()

    # 刷新以加载关系
    await db.refresh(user)
    return ResponseModel(message="用户创建成功", data=UserResponseItem.from_orm_model(user))


@router.put("/{user_id}", response_model=ResponseModel)
async def update_user(
    user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """更新用户"""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        return ResponseModel(success=False, message="用户不存在")

    update_data = data.model_dump(exclude_unset=True)
    # 映射 status → is_active
    if "status" in update_data:
        update_data["is_active"] = (update_data.pop("status") == "active")
    # 处理 role 变更（更新 user_roles 表）
    if "role" in update_data:
        role_name = update_data.pop("role")
        role = (await db.execute(select(Role).where(Role.name == role_name))).scalar_one_or_none()
        if role:
            # 删除旧角色
            old_roles = (await db.execute(select(UserRole).where(UserRole.user_id == user.id))).scalars().all()
            for old in old_roles:
                await db.delete(old)
            # 添加新角色
            db.add(UserRole(user_id=user.id, role_id=role.id))

    for key, value in update_data.items():
        setattr(user, key, value)
    user.updated_at = datetime.now()
    await db.commit()
    await db.refresh(user)
    return ResponseModel(message="用户更新成功", data=UserResponseItem.from_orm_model(user))


@router.delete("/{user_id}", response_model=ResponseModel)
async def delete_user(
    user_id: int, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """删除用户"""
    user_obj = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user_obj:
        return ResponseModel(success=False, message="用户不存在")
    await db.delete(user_obj)
    await db.commit()
    return ResponseModel(message="用户已删除")


# ============================
# 用户状态
# ============================

@router.get("/{user_id}/status", response_model=ResponseModel)
async def get_user_status(
    user_id: int, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    """获取用户在线状态"""
    user_obj = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user_obj:
        return ResponseModel(success=False, message="用户不存在")
    return ResponseModel(data={
        "user_id": user_obj.id,
        "status": "active" if user_obj.is_active else "inactive",
        "last_login_at": user_obj.last_login,
    })



