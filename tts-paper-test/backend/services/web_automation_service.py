"""Web自动化服务"""

import asyncio
import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.web_automation import (
    WebAutomationProject,
    WebPage,
    WebUIElement,
    WebTestCase,
    WebTestExecution,
)
from schemas.web_automation import ProjectCreate
from core.logging_config import get_logger

logger = get_logger("web_explorer")

# 截图存储目录
SCREENSHOTS_DIR = Path(__file__).parent.parent / "uploads" / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


async def create_project(
    db: AsyncSession, data: ProjectCreate, user_id: int
) -> WebAutomationProject:
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


async def list_projects(
    db: AsyncSession, user_id: int = None, page: int = 1, page_size: int = 20
):
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
        page_count = (
            await db.execute(
                select(func.count())
                .select_from(WebPage)
                .where(WebPage.project_id == p.id)
            )
        ).scalar() or 0
        case_count = (
            await db.execute(
                select(func.count())
                .select_from(WebTestCase)
                .where(WebTestCase.project_id == p.id)
            )
        ).scalar() or 0
        items.append(
            {
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
            }
        )

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


async def upsert_page(db: AsyncSession, project_id: int, page_data: dict) -> WebPage:
    """按URL幂等保存探索到的页面（避免SSE流式与最终结果重复入库）"""
    url = page_data.get("url", "")
    result = await db.execute(
        select(WebPage).where(WebPage.project_id == project_id, WebPage.url == url)
    )
    page = result.scalar_one_or_none()
    if not page:
        page = WebPage(project_id=project_id, url=url)
        db.add(page)

    page.title = page_data.get("title") or page.title
    page.page_map = page_data.get("structure") or page.page_map
    # commit 前取值，避免同步阶段读取过期实例属性
    elements_value = page_data.get("elements")
    if elements_value is None:
        elements_value = page.elements if not page._sa_instance_state.expired else None
    if elements_value is not None:
        page.elements = elements_value
    if page_data.get("screenshot"):
        page.screenshot_path = page_data["screenshot"]
    page.exploration_status = (
        page_data.get("status") or page.exploration_status or "completed"
    )

    await db.commit()
    await db.refresh(page)  # commit 过期实例，refresh 后属性可安全读取
    await sync_page_elements(db, page.id, project_id, elements_value)
    await db.refresh(page)  # sync 内部 commit 会再次过期 page，须在返回前刷新
    return page


# ============ 对象库（页面元素） ============


async def sync_page_elements(
    db: AsyncSession, page_id: int, project_id: int, raw_elements
) -> list:
    """将页面 elements JSON 同步为独立的元素对象记录（按 page_id+name 幂等）

    通过显式参数传入数据，避免访问会话中可能过期的 ORM 实例。
    """
    if not isinstance(raw_elements, list):
        raw_elements = []

    # 现有元素（name -> obj）
    result = await db.execute(
        select(WebUIElement)
        .where(WebUIElement.page_id == page_id)
        .execution_options(populate_existing=True)
    )
    existing = {e.name: e for e in result.scalars().all()}

    updated_names: list[str] = []
    for raw in raw_elements:
        if not isinstance(raw, dict):
            continue
        element_type = raw.get("type") or raw.get("tag") or "element"
        attributes = {
            k: raw.get(k)
            for k in (
                "id",
                "name",
                "placeholder",
                "href",
                "tag",
                "text",
                "role",
                "aria_label",
                "value",
                "alt",
            )
            if raw.get(k) is not None
        }
        name = raw.get("name") or raw.get("id") or raw.get("text")
        if not name:
            # 表单等无名称元素：用 placeholder 生成可读名称
            if element_type == "form" and attributes.get("placeholder"):
                name = f"表单-{attributes['placeholder']}"
            else:
                continue
        name = str(name)[:200]
        locator = raw.get("selector") or raw.get("href") or ""

        elem = existing.get(name)
        if elem:
            elem.element_type = element_type
            elem.locator = locator or elem.locator
            elem.attributes = attributes
        else:
            elem = WebUIElement(
                project_id=project_id,
                page_id=page_id,
                name=name,
                element_type=element_type,
                locator=locator,
                attributes=attributes,
            )
            db.add(elem)
        updated_names.append(name)

    await db.commit()
    return updated_names


async def list_object_repo(db: AsyncSession, project_id: int) -> list:
    """对象库列表：页面 + 元素统计（含截图像/结构）"""
    pages_result = await db.execute(
        select(WebPage)
        .where(WebPage.project_id == project_id)
        .order_by(WebPage.id)
        .execution_options(populate_existing=True)
    )
    pages = pages_result.scalars().all()
    if not pages:
        return []

    counts_result = await db.execute(
        select(WebUIElement.page_id, func.count(WebUIElement.id))
        .where(WebUIElement.project_id == project_id)
        .group_by(WebUIElement.page_id)
    )
    counts = dict(counts_result.all())

    result = []
    for p in pages:
        setattr(p, "element_count", counts.get(p.id, 0))
        result.append(p)
    return result


async def list_page_elements(db: AsyncSession, page_id: int) -> list:
    """获取某页面的元素对象列表"""
    result = await db.execute(
        select(WebUIElement)
        .where(WebUIElement.page_id == page_id)
        .order_by(WebUIElement.id)
        .execution_options(populate_existing=True)
    )
    return list(result.scalars().all())


async def create_ui_element(
    db: AsyncSession, project_id: int, page_id: int, data: dict
) -> WebUIElement:
    """手动添加元素对象"""
    elem = WebUIElement(
        project_id=project_id,
        page_id=page_id,
        name=data.get("name", ""),
        element_type=data.get("element_type") or "element",
        locator=data.get("locator"),
        attributes=data.get("attributes") or {},
        description=data.get("description"),
    )
    db.add(elem)
    await db.commit()
    await db.refresh(elem)
    return elem


async def update_ui_element(
    db: AsyncSession, element_id: int, data: dict
) -> WebUIElement:
    """更新元素对象"""
    result = await db.execute(select(WebUIElement).where(WebUIElement.id == element_id))
    elem = result.scalar_one_or_none()
    if not elem:
        raise ValueError("元素对象不存在")
    for k, v in data.items():
        if v is not None:
            setattr(elem, k, v)
    await db.commit()
    await db.refresh(elem)
    return elem


async def delete_ui_element(db: AsyncSession, element_id: int) -> None:
    """删除元素对象"""
    result = await db.execute(select(WebUIElement).where(WebUIElement.id == element_id))
    elem = result.scalar_one_or_none()
    if not elem:
        raise ValueError("元素对象不存在")
    await db.delete(elem)
    await db.commit()


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


async def create_test_case(
    db: AsyncSession, project_id: int, data: dict, user_id: int = None
) -> WebTestCase:
    """手动创建测试用例"""
    case = WebTestCase(
        project_id=project_id,
        page_id=data.get("page_id"),
        title=data["title"],
        description=data.get("description"),
        preconditions=data.get("preconditions"),
        steps=data.get("steps", []),
        expected_result=data.get("expected_result"),
        priority=data.get("priority", "P2"),
        status="draft",
        ai_generated=False,
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    logger.info(f"手动创建测试用例: {case.title} (项目: {project_id})")
    return case


async def delete_test_case(db: AsyncSession, case_id: int):
    """删除测试用例"""
    result = await db.execute(select(WebTestCase).where(WebTestCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise ValueError("测试用例不存在")
    await db.delete(case)
    await db.commit()
    logger.info(f"删除测试用例: {case.title}")
    return case


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


async def approve_test_case(
    db: AsyncSession, case_id: int, user_id: int, note: str = None
):
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


async def reject_test_case(
    db: AsyncSession, case_id: int, user_id: int, note: str = None
):
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
    result = await db.execute(
        select(WebAutomationProject).where(WebAutomationProject.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError("项目不存在")
    project.status = status
    await db.commit()
    return project


async def update_project_summary(
    db: AsyncSession, project_id: int, pages: list[dict]
) -> str:
    """探索完成后生成项目摘要并回填 description（若 description 为空）

    Args:
        pages: 探索到的页面列表 [{title, description, url, ...}]

    Returns:
        生成的摘要文本
    """
    result = await db.execute(
        select(WebAutomationProject).where(WebAutomationProject.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError("项目不存在")

    completed = [p for p in pages if p.get("status") == "completed"]
    summary = f"AI探索摘要（{len(completed)}个页面）"
    if completed:
        summary += "：\n"
        for p in completed[:8]:
            title = p.get("title") or "未命名页面"
            desc = (p.get("description") or "").strip()
            summary += f"- {title}"
            if desc:
                summary += f"：{desc}"
            summary += "\n"
        if len(completed) > 8:
            summary += f"- …等共{len(completed)}个页面"

    # 仅当项目尚无人工描述时回填
    if not project.description:
        project.description = summary
        await db.commit()
        logger.info(f"项目 {project.name} 探索摘要已回填 (共{len(completed)}页)")
    return summary


# ============ 执行记录 CRUD ============


def persist_screenshot(src: str) -> str:
    """将执行引擎产生的临时截图持久化到 uploads/screenshots 目录

    返回可在前端直接使用的文件名（basename）；源路径无法访问时原样返回。
    """
    if not src:
        return ""
    # 已持久化（只含文件名）或非本地文件，不再处理
    if "/" not in src and "\\" not in src:
        return src
    name = Path(src).name
    if not name:
        return src
    try:
        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        dst = SCREENSHOTS_DIR / name
        if dst.exists():
            return name
        source = Path(src)
        if source.exists() and source.is_file():
            shutil.copy2(source, dst)
            return name
    except OSError:
        pass
    return src


async def _attach_case_titles(db: AsyncSession, executions: list) -> None:
    """给执行记录附加用例标题列表（按 execution_case_ids 查询）"""
    case_ids: set[int] = set()
    for exec_obj in executions:
        ids = (
            exec_obj.execution_case_ids
            if isinstance(exec_obj.execution_case_ids, list)
            else []
        )
        ids = [i for i in ids if isinstance(i, int)]
        if exec_obj.test_case_id and exec_obj.test_case_id not in ids:
            ids.append(exec_obj.test_case_id)
        case_ids.update(ids)
    if not case_ids:
        for exec_obj in executions:
            exec_obj.case_titles = []
        return
    result = await db.execute(select(WebTestCase).where(WebTestCase.id.in_(case_ids)))
    title_map = {c.id: c.title or f"测试用例 {c.id}" for c in result.scalars().all()}
    for exec_obj in executions:
        ids = (
            exec_obj.execution_case_ids
            if isinstance(exec_obj.execution_case_ids, list)
            else []
        )
        ids = [i for i in ids if isinstance(i, int)]
        if exec_obj.test_case_id and exec_obj.test_case_id not in ids:
            ids.append(exec_obj.test_case_id)
        exec_obj.case_titles = [title_map.get(cid, f"用例 #{cid}") for cid in ids]


async def create_execution(
    db: AsyncSession, project_id: int, test_case_ids: list[int], user_id: int = None
) -> WebTestExecution:
    """创建执行记录（支持一对多用例关联）"""
    execution = WebTestExecution(
        project_id=project_id,
        test_case_id=test_case_ids[0] if test_case_ids else None,
        execution_case_ids=test_case_ids,
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
    result = await db.execute(
        select(WebTestExecution).where(WebTestExecution.id == execution_id)
    )
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
    result = await db.execute(
        select(WebTestExecution).where(WebTestExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise ValueError("执行记录不存在")
    await _attach_case_titles(db, [execution])
    return execution


async def list_executions(
    db: AsyncSession, project_id: int = None, page: int = 1, page_size: int = 20
):
    """列出执行记录"""
    query = select(WebTestExecution).order_by(WebTestExecution.created_at.desc())
    if project_id:
        query = query.where(WebTestExecution.project_id == project_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()
    await _attach_case_titles(db, list(items))
    return {"items": items, "total": total, "page": page, "page_size": page_size}
