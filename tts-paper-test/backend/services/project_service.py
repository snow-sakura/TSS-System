"""项目管理和版本管理服务"""

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.project import Project, Version
from core.logging_config import get_logger

logger = get_logger("project")


# ============ 工具函数 ============

async def _paginate(db: AsyncSession, query, page: int = 1, page_size: int = 20):
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total > 0 else 1,
    }


async def _get_by_id(db: AsyncSession, model_class, item_id: int):
    result = await db.execute(select(model_class).where(model_class.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise ValueError(f"{model_class.__name__}不存在")
    return item


async def _delete_by_id(db: AsyncSession, model_class, item_id: int):
    item = await _get_by_id(db, model_class, item_id)
    await db.delete(item)
    await db.commit()
    logger.info(f"删除 {model_class.__name__}: {item_id}")


# ============ Project CRUD ============

def _convert_date_fields(data: dict) -> dict:
    """将日期字符串转换为 datetime 对象"""
    from datetime import datetime, date
    
    date_fields = ["start_date", "end_date", "release_date"]
    for field in date_fields:
        if field in data and data[field]:
            value = data[field]
            if isinstance(value, str):
                try:
                    # 尝试解析 ISO 格式日期字符串
                    if len(value) == 10:  # YYYY-MM-DD
                        data[field] = datetime.strptime(value, "%Y-%m-%d")
                    elif len(value) == 16:  # YYYY-MM-DD HH:MM
                        data[field] = datetime.strptime(value, "%Y-%m-%d %H:%M")
                    elif len(value) == 19:  # YYYY-MM-DD HH:MM:SS
                        data[field] = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                    else:
                        data[field] = datetime.fromisoformat(value)
                except (ValueError, TypeError):
                    pass  # 如果转换失败，保持原样
    return data


async def create_project(db: AsyncSession, data: dict, user_id: int = None):
    """创建项目，自动生成项目编码"""
    if not data.get("code"):
        from datetime import datetime as dt
        from sqlalchemy import func
        result = await db.execute(
            select(func.count(Project.id)).where(Project.id > 0)
        )
        count = result.scalar() or 0
        data["code"] = f"PRJ-{dt.now().strftime('%Y%m%d')}-{count + 1:03d}"
    # 如果前端没有传 owner，则使用当前用户 ID
    if not data.get("owner"):
        data["owner"] = user_id
    # 转换日期字段
    data = _convert_date_fields(data)
    project = Project(**data)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    logger.info(f"创建项目: {project.name} (code={project.code})")
    return project


async def get_project(db: AsyncSession, project_id: int):
    return await _get_by_id(db, Project, project_id)


async def list_projects(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str = None,
    search: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
):
    query = select(Project)

    if status:
        query = query.where(Project.status == status)
    if search:
        like = f"%{search}%"
        query = query.where(
            Project.name.ilike(like) | Project.code.ilike(like) | Project.description.ilike(like)
        )

    sort_col = getattr(Project, sort_by, Project.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    return await _paginate(db, query, page, page_size)


async def update_project(db: AsyncSession, project_id: int, data: dict):
    project = await get_project(db, project_id)
    # 转换日期字段
    data = _convert_date_fields(data)
    for k, v in data.items():
        if v is not None:
            setattr(project, k, v)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project_id: int):
    await _delete_by_id(db, Project, project_id)


async def batch_delete_projects(db: AsyncSession, ids: list[int]):
    result = await db.execute(delete(Project).where(Project.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除项目: {ids}")
    return result.rowcount


# ============ Version CRUD ============

async def create_version(db: AsyncSession, data: dict, user_id: int = None):
    """创建版本，将 version_no 映射到 version_number"""
    if "version_no" in data:
        data["version_number"] = data.pop("version_no")
    # 转换日期字段
    data = _convert_date_fields(data)
    version = Version(**data, created_by=user_id)
    db.add(version)
    await db.commit()
    await db.refresh(version)
    logger.info(f"创建版本: {version.name}")
    return version


async def get_version(db: AsyncSession, version_id: int):
    return await _get_by_id(db, Version, version_id)


async def list_versions(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    project_id: int = None,
    status: str = None,
    search: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
):
    query = select(Version)

    if project_id:
        query = query.where(Version.project_id == project_id)
    if status:
        query = query.where(Version.status == status)
    if search:
        like = f"%{search}%"
        query = query.where(
            Version.name.ilike(like) | Version.version_number.ilike(like) | Version.description.ilike(like)
        )

    sort_col = getattr(Version, sort_by, Version.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    return await _paginate(db, query, page, page_size)


async def update_version(db: AsyncSession, version_id: int, data: dict):
    """更新版本，将 version_no 映射到 version_number"""
    version = await get_version(db, version_id)
    if "version_no" in data:
        data["version_number"] = data.pop("version_no")
    # 转换日期字段
    data = _convert_date_fields(data)
    for k, v in data.items():
        if v is not None:
            setattr(version, k, v)
    await db.commit()
    await db.refresh(version)
    return version


async def delete_version(db: AsyncSession, version_id: int):
    await _delete_by_id(db, Version, version_id)


async def batch_delete_versions(db: AsyncSession, ids: list[int]):
    result = await db.execute(delete(Version).where(Version.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除版本: {ids}")
    return result.rowcount
