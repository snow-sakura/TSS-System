"""Web自动化服务"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.web_automation import (
    WebAutomationProject, WebPage, WebTestCase, WebTestExecution
)
from schemas.web_automation import ProjectCreate
from core.logging_config import get_logger

logger = get_logger("web_explorer")

# 截图存储目录
SCREENSHOTS_DIR = Path(__file__).parent.parent / "uploads" / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


async def create_project(db: AsyncSession, data: ProjectCreate, user_id: int) -> WebAutomationProject:
    """创建自动化项目"""
    project = WebAutomationProject(
        name=data.name,
        target_url=data.target_url,
        description=data.description,
        created_by=user_id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    logger.info(f"创建项目: {project.name} -> {project.target_url}")
    return project


async def list_projects(db: AsyncSession, user_id: int = None, page: int = 1, page_size: int = 20):
    """项目列表"""
    query = select(WebAutomationProject)
    if user_id:
        query = query.where(WebAutomationProject.created_by == user_id)

    # 总数
    count_query = select(func.count()).select_from(WebAutomationProject)
    total = (await db.execute(count_query)).scalar() or 0

    # 分页
    query = query.order_by(WebAutomationProject.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    projects = result.scalars().all()

    # 附加统计
    items = []
    for p in projects:
        page_count = (await db.execute(
            select(func.count()).select_from(WebPage).where(WebPage.project_id == p.id)
        )).scalar() or 0
        case_count = (await db.execute(
            select(func.count()).select_from(WebTestCase).where(WebTestCase.project_id == p.id)
        )).scalar() or 0
        items.append({
            "id": p.id,
            "name": p.name,
            "target_url": p.target_url,
            "description": p.description,
            "status": p.status,
            "created_by": p.created_by,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "page_count": page_count,
            "test_case_count": case_count,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


async def get_project(db: AsyncSession, project_id: int) -> WebAutomationProject:
    """获取项目详情"""
    result = await db.execute(
        select(WebAutomationProject).where(WebAutomationProject.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError("项目不存在")
    return project


async def delete_project(db: AsyncSession, project_id: int):
    """删除项目"""
    project = await get_project(db, project_id)
    await db.delete(project)
    await db.commit()
    logger.info(f"删除项目: {project.name}")


async def start_exploration(db: AsyncSession, project_id: int):
    """启动AI探索 - 更新状态为exploring"""
    project = await get_project(db, project_id)
    project.status = "exploring"
    await db.commit()
    logger.info(f"开始探索: {project.name} -> {project.target_url}")
    return {"message": "探索已启动", "project_id": project_id}


async def list_pages(db: AsyncSession, project_id: int):
    """获取项目探索到的页面"""
    result = await db.execute(
        select(WebPage)
        .where(WebPage.project_id == project_id)
        .order_by(WebPage.created_at)
    )
    return result.scalars().all()


async def create_page(db: AsyncSession, project_id: int, page_data: dict):
    """创建探索到的页面记录"""
    page = WebPage(
        project_id=project_id,
        url=page_data.get("url", ""),
        title=page_data.get("title", ""),
        page_map=page_data.get("structure"),
        elements=page_data.get("elements"),
        screenshot_path=page_data.get("screenshot"),
        exploration_status=page_data.get("status", "completed"),
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    logger.info(f"保存页面: {page.title} -> {page.url}")
    return page


async def create_test_cases_from_ai(
    db: AsyncSession,
    project_id: int,
    test_cases: list[dict],
    ai_model: str = "unknown",
):
    """保存AI生成的测试用例"""
    created = []
    for tc in test_cases:
        case = WebTestCase(
            project_id=project_id,
            page_id=tc.get("page_id"),
            title=tc["title"],
            description=tc.get("description"),
            preconditions=tc.get("preconditions"),
            steps=tc["steps"],
            expected_result=tc.get("expected_result"),
            priority=tc.get("priority", "P2"),
            status="draft",
            ai_generated=True,
            ai_model=ai_model,
        )
        db.add(case)
        created.append(case)

    await db.commit()
    for c in created:
        await db.refresh(c)
    logger.info(f"AI生成 {len(created)} 条测试用例 (项目: {project_id})")
    return created


async def list_test_cases(db: AsyncSession, project_id: int, status: str = None):
    """测试用例列表"""
    query = select(WebTestCase).where(WebTestCase.project_id == project_id)
    if status:
        query = query.where(WebTestCase.status == status)
    query = query.order_by(WebTestCase.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def approve_test_case(db: AsyncSession, case_id: int, user_id: int, note: str = None):
    """确认测试用例"""
    result = await db.execute(select(WebTestCase).where(WebTestCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise ValueError("测试用例不存在")
    case.status = "approved"
    case.reviewed_by = user_id
    case.reviewed_at = datetime.now(timezone.utc)
    case.review_note = note
    await db.commit()
    logger.info(f"确认测试用例: {case.title}")
    return case


async def reject_test_case(db: AsyncSession, case_id: int, user_id: int, note: str = None):
    """驳回测试用例"""
    result = await db.execute(select(WebTestCase).where(WebTestCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise ValueError("测试用例不存在")
    case.status = "rejected"
    case.reviewed_by = user_id
    case.reviewed_at = datetime.now(timezone.utc)
    case.review_note = note
    await db.commit()
    return case


async def update_project_status(db: AsyncSession, project_id: int, status: str):
    """更新项目状态"""
    result = await db.execute(select(WebAutomationProject).where(WebAutomationProject.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError("项目不存在")
    project.status = status
    await db.commit()
    return project


# ============ 执行记录 CRUD ============

async def create_execution(db: AsyncSession, project_id: int, test_case_ids: list[int], user_id: int = None) -> WebTestExecution:
    """创建执行记录"""
    execution = WebTestExecution(
        project_id=project_id,
        test_case_id=test_case_ids[0] if test_case_ids else None,
        status="pending",
        executed_by=user_id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    return execution


async def update_execution(db: AsyncSession, execution_id: int, data: dict):
    """更新执行记录"""
    result = await db.execute(select(WebTestExecution).where(WebTestExecution.id == execution_id))
    execution = result.scalar_one_or_none()
    if not execution:
        raise ValueError("执行记录不存在")
    for k, v in data.items():
        if v is not None:
            setattr(execution, k, v)
    await db.commit()
    await db.refresh(execution)
    return execution


async def get_execution(db: AsyncSession, execution_id: int):
    """获取执行记录"""
    result = await db.execute(select(WebTestExecution).where(WebTestExecution.id == execution_id))
    execution = result.scalar_one_or_none()
    if not execution:
        raise ValueError("执行记录不存在")
    return execution


async def list_executions(db: AsyncSession, project_id: int = None, page: int = 1, page_size: int = 20):
    """列出执行记录"""
    query = select(WebTestExecution).order_by(WebTestExecution.created_at.desc())
    if project_id:
        query = query.where(WebTestExecution.project_id == project_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}
