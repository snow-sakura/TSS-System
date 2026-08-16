"""测试生命周期服务 - 覆盖7个阶段的CRUD操作"""

from typing import Optional, Any
from datetime import datetime
from sqlalchemy import select, func, delete, cast, String, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from models.test_lifecycle import (
    Requirement,
    TestPlan,
    TestPoint,
    TestCase as LifecycleTestCase,
    TestExecution as LifecycleTestExecution,
    Defect,
    TestReport,
    Review,
)
from core.logging_config import get_logger

logger = get_logger("test_lifecycle")


# ============ 工具函数 ============


async def _paginate(db: AsyncSession, query, page: int = 1, page_size: int = 20):
    """通用分页查询"""
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
    """通用按ID查询"""
    result = await db.execute(select(model_class).where(model_class.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise ValueError(f"{model_class.__name__}不存在")
    return item


async def _delete_by_id(db: AsyncSession, model_class, item_id: int):
    """通用按ID删除"""
    item = await _get_by_id(db, model_class, item_id)
    await db.delete(item)
    await db.commit()
    logger.info(f"删除 {model_class.__name__}: {item_id}")


# ============ 需求 CRUD (增强) ============


async def list_requirements(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str = None,
    priority: str = None,
    source: str = None,
    search: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    project_id: int = None,
    version_id: int = None,
):
    """增强的需求列表查询，支持多条件筛选和全文搜索"""
    query = select(Requirement).options(
        selectinload(Requirement.project),
        selectinload(Requirement.version),
    )

    if project_id:
        query = query.where(Requirement.project_id == project_id)
    if version_id:
        query = query.where(Requirement.version_id == version_id)

    if status:
        query = query.where(Requirement.status == status)
    if priority:
        query = query.where(Requirement.priority == priority)
    if source:
        query = query.where(Requirement.source == source)
    if search:
        like = f"%{search}%"
        query = query.where(
            Requirement.name.ilike(like) | Requirement.description.ilike(like)
        )

    # 排序
    sort_col = getattr(Requirement, sort_by, Requirement.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    return await _paginate(db, query, page, page_size)


async def get_requirement(db: AsyncSession, requirement_id: int):
    return await _get_by_id(db, Requirement, requirement_id)


async def create_requirement(db: AsyncSession, data: dict, user_id: int = None):
    """创建需求，自动设置 source、initial status 和编号"""
    if "source" not in data or not data["source"]:
        data["source"] = "manual"
    if "status" not in data or not data["status"]:
        data["status"] = "draft"
    if not data.get("code"):
        result = await db.execute(
            sa_select(func.count(Requirement.id)).where(Requirement.id > 0)
        )
        count = result.scalar() or 0
        data["code"] = f"REQ-{datetime.now().strftime('%Y%m%d')}-{count + 1:03d}"
    req = Requirement(**data, created_by=user_id)
    db.add(req)
    await db.commit()
    await db.refresh(req)
    logger.info(f"创建需求: {req.name} (code={req.code}, source={req.source})")
    return req


async def update_requirement(db: AsyncSession, requirement_id: int, data: dict):
    req = await get_requirement(db, requirement_id)
    for k, v in data.items():
        if v is not None:
            setattr(req, k, v)
    await db.commit()
    await db.refresh(req)
    return req


async def delete_requirement(db: AsyncSession, requirement_id: int):
    await _delete_by_id(db, Requirement, requirement_id)


async def batch_delete_requirements(db: AsyncSession, ids: list[int]):
    """批量删除需求"""
    from sqlalchemy import delete as sa_delete

    result = await db.execute(sa_delete(Requirement).where(Requirement.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除需求: {ids}")
    return result.rowcount


async def update_requirement_status(db: AsyncSession, requirement_id: int, status: str):
    """快速更新需求状态"""
    req = await get_requirement(db, requirement_id)
    req.status = status
    await db.commit()
    await db.refresh(req)
    return req


# ============ 测试方案 CRUD ============


async def list_test_plans(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str = None,
    project_id: int = None,
    version_id: int = None,
):
    query = (
        select(TestPlan)
        .options(
            selectinload(TestPlan.project),
            selectinload(TestPlan.version),
            selectinload(TestPlan.user),
        )
        .order_by(TestPlan.created_at.desc())
    )
    if project_id:
        query = query.where(TestPlan.project_id == project_id)
    if version_id:
        query = query.where(TestPlan.version_id == version_id)
    if status:
        query = query.where(TestPlan.status == status)
    return await _paginate(db, query, page, page_size)


async def get_test_plan(db: AsyncSession, plan_id: int):
    return await _get_by_id(db, TestPlan, plan_id)


async def create_test_plan(db: AsyncSession, data: dict, user_id: int = None):
    owner_id = data.pop("created_by", None) or user_id
    plan = TestPlan(**data, created_by=owner_id)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    logger.info(f"创建测试方案: {plan.name}")
    return plan


async def update_test_plan(db: AsyncSession, plan_id: int, data: dict):
    plan = await get_test_plan(db, plan_id)
    for k, v in data.items():
        if v is not None:
            setattr(plan, k, v)
    await db.commit()
    await db.refresh(plan)
    return plan


async def delete_test_plan(db: AsyncSession, plan_id: int):
    await _delete_by_id(db, TestPlan, plan_id)


async def batch_delete_test_plans(db: AsyncSession, ids: list[int]):
    from sqlalchemy import delete as sa_delete

    result = await db.execute(sa_delete(TestPlan).where(TestPlan.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除测试方案: {ids}")
    return result.rowcount


# ============ 测试点 CRUD ============


async def list_test_points(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str = None,
    project_id: int = None,
    version_id: int = None,
):
    query = (
        select(TestPoint)
        .options(
            selectinload(TestPoint.project),
            selectinload(TestPoint.version),
        )
        .order_by(TestPoint.created_at.desc())
    )
    if project_id:
        query = query.where(TestPoint.project_id == project_id)
    if version_id:
        query = query.where(TestPoint.version_id == version_id)
    if status:
        query = query.where(TestPoint.status == status)
    return await _paginate(db, query, page, page_size)


async def get_test_point(db: AsyncSession, point_id: int):
    return await _get_by_id(db, TestPoint, point_id)


async def create_test_point(db: AsyncSession, data: dict, user_id: int = None):
    point = TestPoint(**data, created_by=user_id)
    db.add(point)
    await db.commit()
    await db.refresh(point)
    return point


async def update_test_point(db: AsyncSession, point_id: int, data: dict):
    point = await get_test_point(db, point_id)
    for k, v in data.items():
        if v is not None:
            setattr(point, k, v)
    await db.commit()
    await db.refresh(point)
    return point


async def delete_test_point(db: AsyncSession, point_id: int):
    await _delete_by_id(db, TestPoint, point_id)


async def batch_delete_test_points(db: AsyncSession, ids: list[int]):
    from sqlalchemy import delete as sa_delete

    result = await db.execute(sa_delete(TestPoint).where(TestPoint.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除测试点: {ids}")
    return result.rowcount


# ============ 测试用例 CRUD ============


async def list_lifecycle_test_cases(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str = None,
    project_id: int = None,
    version_id: int = None,
    tag: str = None,
):
    query = (
        select(LifecycleTestCase)
        .options(
            selectinload(LifecycleTestCase.project),
            selectinload(LifecycleTestCase.version),
        )
        .order_by(LifecycleTestCase.created_at.desc())
    )
    if project_id:
        query = query.where(LifecycleTestCase.project_id == project_id)
    if version_id:
        query = query.where(LifecycleTestCase.version_id == version_id)
    if status:
        query = query.where(LifecycleTestCase.status == status)
    if tag:
        # JSON 数组字段按文本匹配（SQLite/PostgreSQL 均可用），如 ["冒烟","回归"] 匹配 "冒烟"
        # 兼容两种存储形式：直接中文（新数据）与 \uXXXX 转义（历史数据）
        col = cast(LifecycleTestCase.tags, String)
        escaped = tag.encode("unicode_escape").decode("ascii")
        query = query.where(or_(col.like(f'%"{tag}"%'), col.like(f'%"{escaped}"%')))
    return await _paginate(db, query, page, page_size)


async def get_lifecycle_test_case(db: AsyncSession, case_id: int):
    return await _get_by_id(db, LifecycleTestCase, case_id)


async def create_lifecycle_test_case(db: AsyncSession, data: dict, user_id: int = None):
    case = LifecycleTestCase(**data, created_by=user_id)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    logger.info(f"创建测试用例: {case.name}")
    return case


async def update_lifecycle_test_case(db: AsyncSession, case_id: int, data: dict):
    case = await get_lifecycle_test_case(db, case_id)
    for k, v in data.items():
        if v is not None:
            setattr(case, k, v)
    await db.commit()
    await db.refresh(case)
    return case


async def delete_lifecycle_test_case(db: AsyncSession, case_id: int):
    await _delete_by_id(db, LifecycleTestCase, case_id)


async def batch_delete_test_cases(db: AsyncSession, ids: list[int]):
    """批量删除测试用例"""
    from sqlalchemy import delete as sa_delete

    result = await db.execute(
        sa_delete(LifecycleTestCase).where(LifecycleTestCase.id.in_(ids))
    )
    await db.commit()
    logger.info(f"批量删除测试用例: {ids}")
    return result.rowcount


async def review_test_case(
    db: AsyncSession,
    case_id: int,
    action: str,
    review_comment: str = None,
    reviewer_id: int = None,
):
    """评审测试用例: approved / rejected / needs_modification"""
    case = await get_lifecycle_test_case(db, case_id)
    status_map = {
        "approved": "approved",
        "rejected": "rejected",
        "needs_modification": "needs_modification",
    }
    if action not in status_map:
        raise ValueError(f"无效的评审动作: {action}")
    case.status = status_map[action]
    case.reviewed_by = reviewer_id
    case.reviewed_at = func.now()
    if review_comment:
        # review_comment can be stored in description or a separate field
        # For now, append to existing description
        existing = case.description or ""
        case.description = f"{existing}\n[评审备注] {review_comment}".strip()
    await db.commit()
    await db.refresh(case)
    logger.info(f"评审测试用例 #{case_id}: {action} by user {reviewer_id}")
    return case


# ============ 执行 CRUD ============


async def list_executions(
    db: AsyncSession, page: int = 1, page_size: int = 20, status: str = None
):
    query = select(LifecycleTestExecution).order_by(
        LifecycleTestExecution.created_at.desc()
    )
    if status:
        query = query.where(LifecycleTestExecution.status == status)
    return await _paginate(db, query, page, page_size)


async def get_execution(db: AsyncSession, execution_id: int):
    return await _get_by_id(db, LifecycleTestExecution, execution_id)


async def create_execution(db: AsyncSession, data: dict, user_id: int = None):
    execution = LifecycleTestExecution(**data, executed_by=user_id)
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    return execution


async def update_execution(db: AsyncSession, execution_id: int, data: dict):
    execution = await get_execution(db, execution_id)
    for k, v in data.items():
        if v is not None:
            setattr(execution, k, v)
    await db.commit()
    await db.refresh(execution)
    return execution


async def delete_execution(db: AsyncSession, execution_id: int):
    await _delete_by_id(db, LifecycleTestExecution, execution_id)


async def batch_delete_executions(db: AsyncSession, ids: list[int]):
    from sqlalchemy import delete as sa_delete

    result = await db.execute(
        sa_delete(LifecycleTestExecution).where(LifecycleTestExecution.id.in_(ids))
    )
    await db.commit()
    logger.info(f"批量删除执行记录: {ids}")
    return result.rowcount


# ============ 缺陷 CRUD ============


async def list_defects(
    db: AsyncSession, page: int = 1, page_size: int = 20, status: str = None
):
    query = select(Defect).order_by(Defect.created_at.desc())
    if status:
        query = query.where(Defect.status == status)
    return await _paginate(db, query, page, page_size)


async def get_defect(db: AsyncSession, defect_id: int):
    return await _get_by_id(db, Defect, defect_id)


async def create_defect(db: AsyncSession, data: dict, user_id: int = None):
    defect = Defect(**data, created_by=user_id)
    db.add(defect)
    await db.commit()
    await db.refresh(defect)
    logger.info(f"创建缺陷: {defect.title}")
    return defect


async def update_defect(db: AsyncSession, defect_id: int, data: dict):
    defect = await get_defect(db, defect_id)
    for k, v in data.items():
        if v is not None:
            setattr(defect, k, v)
    await db.commit()
    await db.refresh(defect)
    return defect


async def delete_defect(db: AsyncSession, defect_id: int):
    await _delete_by_id(db, Defect, defect_id)


async def batch_delete_defects(db: AsyncSession, ids: list[int]):
    """批量删除缺陷"""
    from sqlalchemy import delete as sa_delete

    result = await db.execute(sa_delete(Defect).where(Defect.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除缺陷: {ids}")
    return result.rowcount


# ============ 报告 CRUD ============


async def list_reports(
    db: AsyncSession, page: int = 1, page_size: int = 20, status: str = None
):
    query = select(TestReport).order_by(TestReport.created_at.desc())
    if status:
        query = query.where(TestReport.status == status)
    return await _paginate(db, query, page, page_size)


async def get_report(db: AsyncSession, report_id: int):
    return await _get_by_id(db, TestReport, report_id)


async def create_report(db: AsyncSession, data: dict, user_id: int = None):
    report = TestReport(**data, created_by=user_id)
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


async def update_report(db: AsyncSession, report_id: int, data: dict):
    report = await get_report(db, report_id)
    for k, v in data.items():
        if v is not None:
            setattr(report, k, v)
    await db.commit()
    await db.refresh(report)
    return report


async def delete_report(db: AsyncSession, report_id: int):
    await _delete_by_id(db, TestReport, report_id)


async def batch_delete_reports(db: AsyncSession, ids: list[int]):
    from sqlalchemy import delete as sa_delete

    result = await db.execute(sa_delete(TestReport).where(TestReport.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除报告: {ids}")
    return result.rowcount


# ============ 评审 CRUD ============


async def list_reviews(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str = None,
    review_type: str = None,
    project_id: int = None,
    version_id: int = None,
):
    query = (
        select(Review)
        .options(
            selectinload(Review.project),
            selectinload(Review.version),
        )
        .order_by(Review.created_at.desc())
    )
    if project_id:
        query = query.where(Review.project_id == project_id)
    if version_id:
        query = query.where(Review.version_id == version_id)
    if status:
        query = query.where(Review.status == status)
    if review_type:
        query = query.where(Review.review_type == review_type)
    return await _paginate(db, query, page, page_size)


async def get_review(db: AsyncSession, review_id: int):
    return await _get_by_id(db, Review, review_id)


async def create_review(db: AsyncSession, data: dict, user_id: int = None):
    review = Review(**data, created_by=user_id)
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


async def update_review(db: AsyncSession, review_id: int, data: dict):
    review = await get_review(db, review_id)
    for k, v in data.items():
        if v is not None:
            setattr(review, k, v)
    await db.commit()
    await db.refresh(review)
    return review


async def delete_review(db: AsyncSession, review_id: int):
    await _delete_by_id(db, Review, review_id)


async def batch_delete_reviews(db: AsyncSession, ids: list[int]):
    result = await db.execute(delete(Review).where(Review.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除评审: {ids}")
    return result.rowcount


# ============ 流程记录 CRUD ============


async def delete_pipeline_record(db: AsyncSession, record_id: int):
    from models.test_lifecycle import PipelineRecord

    await _delete_by_id(db, PipelineRecord, record_id)


async def batch_delete_pipeline_records(db: AsyncSession, ids: list[int]):
    from models.test_lifecycle import PipelineRecord

    result = await db.execute(delete(PipelineRecord).where(PipelineRecord.id.in_(ids)))
    await db.commit()
    logger.info(f"批量删除流程记录: {ids}")
    return result.rowcount
