"""项目管理和版本管理路由"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from api.deps import get_current_user_dep
from schemas.common import ResponseModel
from schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    VersionCreate, VersionUpdate, VersionResponse,
)
from services import project_service as ps

router = APIRouter(tags=["项目管理"])


# ============ Project ============

@router.post("/projects", response_model=ResponseModel)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    project = await ps.create_project(db, body.model_dump(), user.id)
    return ResponseModel(message="项目创建成功", data=ProjectResponse.model_validate(project))


@router.get("/projects", response_model=ResponseModel)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = None,
    search: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    result = await ps.list_projects(db, page, page_size, status, search, sort_by, sort_order)
    result["items"] = [ProjectResponse.model_validate(p) for p in result["items"]]
    return ResponseModel(data=result)


@router.get("/projects/{project_id}", response_model=ResponseModel)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    project = await ps.get_project(db, project_id)
    return ResponseModel(data=ProjectResponse.model_validate(project))


@router.put("/projects/{project_id}", response_model=ResponseModel)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    project = await ps.update_project(db, project_id, body.model_dump(exclude_unset=True))
    return ResponseModel(message="更新成功", data=ProjectResponse.model_validate(project))


@router.delete("/projects/{project_id}", response_model=ResponseModel)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    await ps.delete_project(db, project_id)
    return ResponseModel(message="项目已删除")


@router.post("/projects/batch-delete", response_model=ResponseModel)
async def batch_delete_projects(
    ids: list[int],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    count = await ps.batch_delete_projects(db, ids)
    return ResponseModel(message=f"已删除 {count} 个项目")


# ============ Version ============

@router.post("/versions", response_model=ResponseModel)
async def create_version(
    body: VersionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    version = await ps.create_version(db, body.model_dump(), user.id)
    return ResponseModel(message="版本创建成功", data=VersionResponse.model_validate(version))


@router.get("/versions", response_model=ResponseModel)
async def list_versions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    project_id: int = None,
    status: str = None,
    search: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    result = await ps.list_versions(db, page, page_size, project_id, status, search, sort_by, sort_order)
    result["items"] = [VersionResponse.model_validate(v) for v in result["items"]]
    return ResponseModel(data=result)


@router.get("/versions/{version_id}", response_model=ResponseModel)
async def get_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    version = await ps.get_version(db, version_id)
    return ResponseModel(data=VersionResponse.model_validate(version))


@router.put("/versions/{version_id}", response_model=ResponseModel)
async def update_version(
    version_id: int,
    body: VersionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    version = await ps.update_version(db, version_id, body.model_dump(exclude_unset=True))
    return ResponseModel(message="更新成功", data=VersionResponse.model_validate(version))


@router.delete("/versions/{version_id}", response_model=ResponseModel)
async def delete_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    await ps.delete_version(db, version_id)
    return ResponseModel(message="版本已删除")


@router.post("/versions/batch-delete", response_model=ResponseModel)
async def batch_delete_versions(
    ids: list[int],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    count = await ps.batch_delete_versions(db, ids)
    return ResponseModel(message=f"已删除 {count} 个版本")
