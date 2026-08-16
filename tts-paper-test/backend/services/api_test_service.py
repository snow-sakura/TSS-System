"""AI接口自动化服务"""

import asyncio
import json
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.api_test import (
    ApiTestProject,
    ApiEnvironment,
    ApiEndpoint,
    ApiTestCase,
    ApiExecution,
    ApiTestReport,
)
from schemas.api_test import ProjectCreate, ProjectUpdate, EndpointUpdate
from core.logging_config import get_logger

logger = get_logger("api_test")


# ════════════ 项目 ════════════


async def create_project(
    db: AsyncSession, data: ProjectCreate, user_id: int
) -> ApiTestProject:
    """创建接口测试项目"""
    project = ApiTestProject(
        name=data.name,
        base_url=data.base_url,
        description=data.description,
        created_by=user_id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    logger.info(f"创建接口测试项目: {project.name} -> {project.base_url}")
    return project


async def list_projects(
    db: AsyncSession,
    user_id: int = None,
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
):
    """项目列表"""
    query = select(ApiTestProject)
    if user_id:
        query = query.where(ApiTestProject.created_by == user_id)
    if keyword:
        query = query.where(ApiTestProject.name.contains(keyword))

    count_query = select(func.count()).select_from(ApiTestProject)
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(ApiTestProject.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    projects = result.scalars().all()

    items = []
    for p in projects:
        endpoint_count = (
            await db.execute(
                select(func.count())
                .select_from(ApiEndpoint)
                .where(ApiEndpoint.project_id == p.id)
            )
        ).scalar() or 0
        case_count = (
            await db.execute(
                select(func.count())
                .select_from(ApiTestCase)
                .where(ApiTestCase.project_id == p.id)
            )
        ).scalar() or 0
        items.append(
            {
                "id": p.id,
                "name": p.name,
                "base_url": p.base_url,
                "description": p.description,
                "status": p.status,
                "created_by": p.created_by,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
                "endpoint_count": endpoint_count,
                "case_count": case_count,
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


async def get_project(db: AsyncSession, project_id: int) -> ApiTestProject:
    """获取项目详情"""
    result = await db.execute(
        select(ApiTestProject).where(ApiTestProject.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError("项目不存在")
    return project


async def update_project(
    db: AsyncSession, project_id: int, data: ProjectUpdate
) -> ApiTestProject:
    """更新项目"""
    project = await get_project(db, project_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project_id: int):
    """删除项目"""
    project = await get_project(db, project_id)
    await db.delete(project)
    await db.commit()
    logger.info(f"删除接口测试项目: {project.name}")


# ════════════ 环境配置 ════════════


async def list_environments(
    db: AsyncSession,
    user_id: int = None,
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
):
    """环境列表"""
    query = select(ApiEnvironment)
    if user_id:
        query = query.where(ApiEnvironment.created_by == user_id)
    if keyword:
        query = query.where(ApiEnvironment.name.contains(keyword))

    total = (
        await db.execute(select(func.count()).select_from(ApiEnvironment))
    ).scalar() or 0

    query = query.order_by(ApiEnvironment.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": e.id,
                "name": e.name,
                "base_url": e.base_url,
                "auth_type": e.auth_type,
                "auth_config": e.auth_config,
                "status": e.status,
                "created_at": e.created_at,
                "updated_at": e.updated_at,
            }
            for e in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


async def create_environment(db: AsyncSession, data, user_id: int) -> ApiEnvironment:
    """创建环境"""
    env = ApiEnvironment(
        name=data.name,
        base_url=data.base_url,
        auth_type=data.auth_type or "无",
        auth_config=data.auth_config,
        created_by=user_id,
    )
    db.add(env)
    await db.commit()
    await db.refresh(env)
    return env


async def update_environment(db: AsyncSession, env_id: int, data) -> ApiEnvironment:
    """更新环境"""
    result = await db.execute(select(ApiEnvironment).where(ApiEnvironment.id == env_id))
    env = result.scalar_one_or_none()
    if not env:
        raise ValueError("环境不存在")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(env, key, value)
    await db.commit()
    await db.refresh(env)
    return env


async def delete_environment(db: AsyncSession, env_id: int):
    """删除环境"""
    result = await db.execute(select(ApiEnvironment).where(ApiEnvironment.id == env_id))
    env = result.scalar_one_or_none()
    if not env:
        raise ValueError("环境不存在")
    await db.delete(env)
    await db.commit()


async def test_environment_connection(db: AsyncSession, env_id: int) -> ApiEnvironment:
    """测试环境连接（轻量探测 base_url 可达性）"""
    result = await db.execute(select(ApiEnvironment).where(ApiEnvironment.id == env_id))
    env = result.scalar_one_or_none()
    if not env:
        raise ValueError("环境不存在")

    import httpx

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                env.base_url.rstrip("/") + "/", follow_redirects=True
            )
            env.status = "已连接" if resp.status_code < 500 else "未连接"
    except Exception as e:  # noqa: BLE001
        logger.warning(f"环境连接探测失败: {env.name}: {e}")
        env.status = "未连接"
    await db.commit()
    await db.refresh(env)
    return env


# ════════════ 接口端点 ════════════


async def list_endpoints(
    db: AsyncSession,
    project_id: Optional[int] = None,
    user_id: int = None,
    page: int = 1,
    page_size: int = 50,
    keyword: Optional[str] = None,
):
    """接口列表（支持按项目过滤，默认查全部）"""
    query = select(ApiEndpoint)
    if project_id:
        query = query.where(ApiEndpoint.project_id == project_id)
    if user_id:
        # 通过项目归属过滤
        query = query.join(ApiTestProject).where(ApiTestProject.created_by == user_id)
    if keyword:
        query = query.where(
            ApiEndpoint.name.contains(keyword) | ApiEndpoint.url.contains(keyword)
        )

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar() or 0

    query = query.order_by(ApiEndpoint.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    endpoints = result.scalars().all()

    items = []
    for e in endpoints:
        project = await get_project(db, e.project_id)
        items.append(
            {
                "id": e.id,
                "project_id": e.project_id,
                "project_name": project.name,
                "name": e.name,
                "method": e.method,
                "url": e.url,
                "headers": e.headers,
                "params": e.params,
                "body": e.body,
                "status": e.status,
                "response_time_ms": e.response_time_ms,
                "last_checked_at": e.last_checked_at,
                "created_at": e.created_at,
                "updated_at": e.updated_at,
            }
        )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


async def create_endpoint(db: AsyncSession, data, user_id: int) -> ApiEndpoint:
    """创建接口"""
    await get_project(db, data.project_id)
    endpoint = ApiEndpoint(
        project_id=data.project_id,
        name=data.name,
        method=data.method.upper(),
        url=data.url,
        headers=data.headers,
        params=data.params,
        body=data.body,
        created_by=user_id,
    )
    db.add(endpoint)
    await db.commit()
    await db.refresh(endpoint)
    return endpoint


async def update_endpoint(
    db: AsyncSession, endpoint_id: int, data: EndpointUpdate
) -> ApiEndpoint:
    """更新接口"""
    result = await db.execute(select(ApiEndpoint).where(ApiEndpoint.id == endpoint_id))
    endpoint = result.scalar_one_or_none()
    if not endpoint:
        raise ValueError("接口不存在")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(endpoint, key, value)
    if "method" in update_data and update_data["method"]:
        endpoint.method = update_data["method"].upper()
    await db.commit()
    await db.refresh(endpoint)
    return endpoint


async def delete_endpoint(db: AsyncSession, endpoint_id: int):
    """删除接口"""
    result = await db.execute(select(ApiEndpoint).where(ApiEndpoint.id == endpoint_id))
    endpoint = result.scalar_one_or_none()
    if not endpoint:
        raise ValueError("接口不存在")
    await db.delete(endpoint)
    await db.commit()


async def test_endpoint(db: AsyncSession, endpoint_id: int) -> ApiEndpoint:
    """探测接口可达性（真实请求获取响应时间与状态）"""
    result = await db.execute(select(ApiEndpoint).where(ApiEndpoint.id == endpoint_id))
    endpoint = result.scalar_one_or_none()
    if not endpoint:
        raise ValueError("接口不存在")

    import httpx

    started = datetime.now()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.request(
                endpoint.method,
                endpoint.url,
                headers=endpoint.headers,
                params=endpoint.params,
                json=endpoint.body,
                follow_redirects=True,
            )
        endpoint.status = "正常" if resp.status_code < 400 else "异常"
    except Exception as e:  # noqa: BLE001
        logger.warning(f"接口探测失败: {endpoint.name}: {e}")
        endpoint.status = "异常"
    endpoint.response_time_ms = int((datetime.now() - started).total_seconds() * 1000)
    endpoint.last_checked_at = datetime.now()
    await db.commit()
    await db.refresh(endpoint)
    return endpoint


# ════════════ 测试用例 ════════════


async def list_test_cases(
    db: AsyncSession,
    project_id: Optional[int] = None,
    user_id: int = None,
    page: int = 1,
    page_size: int = 50,
    keyword: Optional[str] = None,
    status: Optional[str] = None,
):
    """用例列表"""
    query = select(ApiTestCase)
    if project_id:
        query = query.where(ApiTestCase.project_id == project_id)
    if user_id:
        query = query.join(ApiTestProject).where(ApiTestProject.created_by == user_id)
    if keyword:
        query = query.where(ApiTestCase.name.contains(keyword))
    if status:
        query = query.where(ApiTestCase.status == status)

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar() or 0

    query = query.order_by(ApiTestCase.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    cases = result.scalars().all()

    items = []
    for c in cases:
        project = await get_project(db, c.project_id)
        items.append(
            {
                "id": c.id,
                "project_id": c.project_id,
                "project_name": project.name,
                "endpoint_id": c.endpoint_id,
                "name": c.name,
                "method": c.method,
                "url": c.url,
                "expected_status": c.expected_status,
                "priority": c.priority,
                "status": c.status,
                "source": c.source,
                "ai_model": c.ai_model,
                "last_result": c.last_result,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
            }
        )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


async def create_test_case(db: AsyncSession, data, user_id: int) -> ApiTestCase:
    """创建测试用例"""
    await get_project(db, data.project_id)
    case = ApiTestCase(
        project_id=data.project_id,
        name=data.name,
        endpoint_id=data.endpoint_id,
        method=data.method.upper(),
        url=data.url,
        expected_status=data.expected_status,
        priority=data.priority,
        source=data.source or "手动",
        ai_model=data.ai_model,
        created_by=user_id,
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


async def update_test_case(db: AsyncSession, case_id: int, data) -> ApiTestCase:
    """更新测试用例"""
    result = await db.execute(select(ApiTestCase).where(ApiTestCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise ValueError("用例不存在")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(case, key, value)
    if "method" in update_data and update_data["method"]:
        case.method = update_data["method"].upper()
    await db.commit()
    await db.refresh(case)
    return case


async def delete_test_case(db: AsyncSession, case_id: int):
    """删除测试用例"""
    result = await db.execute(select(ApiTestCase).where(ApiTestCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise ValueError("用例不存在")
    await db.delete(case)
    await db.commit()


# ════════════ 执行 ════════════


async def create_execution(
    db: AsyncSession,
    project_id: int,
    case_ids: Optional[list[int]],
    user_id: int,
    name: str = "接口测试执行",
) -> ApiExecution:
    """创建执行记录（不执行，仅落库状态为"执行中"）"""
    project = await get_project(db, project_id)
    execution = ApiExecution(
        project_id=project_id,
        name=f"{project.name}-{name}",
        case_ids=case_ids or [],
        total=0,
        passed=0,
        failed=0,
        pass_rate=0.0,
        status="执行中",
        started_at=datetime.now(),
        executed_by=user_id,
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    return execution


async def list_executions(
    db: AsyncSession,
    project_id: Optional[int] = None,
    user_id: int = None,
    page: int = 1,
    page_size: int = 20,
):
    """执行记录列表"""
    query = select(ApiExecution)
    if project_id:
        query = query.where(ApiExecution.project_id == project_id)
    if user_id:
        query = query.join(ApiTestProject).where(ApiTestProject.created_by == user_id)

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar() or 0

    query = query.order_by(ApiExecution.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    executions = result.scalars().all()

    items = []
    for e in executions:
        project = await get_project(db, e.project_id)
        items.append(
            {
                "id": e.id,
                "project_id": e.project_id,
                "project_name": project.name,
                "name": e.name,
                "case_ids": e.case_ids,
                "total": e.total,
                "passed": e.passed,
                "failed": e.failed,
                "pass_rate": e.pass_rate,
                "status": e.status,
                "started_at": e.started_at,
                "completed_at": e.completed_at,
                "duration_ms": e.duration_ms,
                "results": e.results,
                "error_message": e.error_message,
                "created_at": e.created_at,
            }
        )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


async def get_execution(db: AsyncSession, execution_id: int) -> ApiExecution:
    """获取执行详情"""
    result = await db.execute(
        select(ApiExecution).where(ApiExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise ValueError("执行记录不存在")
    return execution


async def run_execution(db: AsyncSession, execution_id: int):
    """真正执行接口测试（后台任务）：
    逐用例发送真实 HTTP 请求，比对状态码，更新用例结果与执行统计
    """
    import httpx

    execution = await get_execution(db, execution_id)

    # 收集本次执行的目标用例：指定 case_ids 或项目内全部待执行/失败用例
    if execution.case_ids:
        result = await db.execute(
            select(ApiTestCase).where(ApiTestCase.id.in_(execution.case_ids))
        )
        cases = list(result.scalars().all())
    else:
        result = await db.execute(
            select(ApiTestCase)
            .where(ApiTestCase.project_id == execution.project_id)
            .where(ApiTestCase.status.in_(["待执行", "失败"]))
        )
        cases = list(result.scalars().all())

    results = []
    passed, failed = 0, 0
    started = datetime.now()
    error_message = None

    try:
        for case in cases:
            try:
                req_started = datetime.now()
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.request(
                        case.method,
                        case.url,
                        follow_redirects=True,
                    )
                duration = int((datetime.now() - req_started).total_seconds() * 1000)
                ok = resp.status_code == case.expected_status
                detail = {
                    "case_id": case.id,
                    "name": case.name,
                    "method": case.method,
                    "url": case.url,
                    "expected_status": case.expected_status,
                    "actual_status": resp.status_code,
                    "duration_ms": duration,
                    "passed": ok,
                }
                results.append(detail)
                if ok:
                    passed += 1
                else:
                    failed += 1
                case.status = "通过" if ok else "失败"
                case.last_result = detail
            except Exception as e:  # noqa: BLE001
                logger.warning(f"用例执行失败: {case.name}: {e}")
                detail = {
                    "case_id": case.id,
                    "name": case.name,
                    "method": case.method,
                    "url": case.url,
                    "expected_status": case.expected_status,
                    "actual_status": None,
                    "error": str(e),
                    "passed": False,
                }
                results.append(detail)
                failed += 1
                case.status = "失败"
                case.last_result = detail
    except Exception as e:  # noqa: BLE001
        error_message = str(e)
        logger.error(f"执行流程异常: {e}")

    total = passed + failed
    execution.total = total
    execution.passed = passed
    execution.failed = failed
    execution.pass_rate = round(passed / total * 100, 1) if total else 0.0
    execution.results = results
    execution.status = "完成" if error_message is None else "失败"
    execution.completed_at = datetime.now()
    execution.duration_ms = int((datetime.now() - started).total_seconds() * 1000)
    execution.error_message = error_message
    await db.commit()
    logger.info(
        f"接口执行完成: {execution.name} 通过{passed}/{total} "
        f"通过率{execution.pass_rate}%"
    )


# ════════════ 报告 ════════════


async def list_reports(
    db: AsyncSession,
    project_id: Optional[int] = None,
    user_id: int = None,
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
):
    """报告列表"""
    query = select(ApiTestReport)
    if project_id:
        query = query.where(ApiTestReport.project_id == project_id)
    if user_id:
        query = query.join(ApiTestProject).where(ApiTestProject.created_by == user_id)
    if keyword:
        query = query.where(ApiTestReport.name.contains(keyword))

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar() or 0

    query = query.order_by(ApiTestReport.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    reports = result.scalars().all()

    items = []
    for r in reports:
        project = await get_project(db, r.project_id)
        items.append(
            {
                "id": r.id,
                "project_id": r.project_id,
                "project_name": project.name,
                "name": r.name,
                "report_type": r.report_type,
                "total_cases": r.total_cases,
                "passed": r.passed,
                "pass_rate": r.pass_rate,
                "content": r.content,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
        )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


async def generate_report(
    db: AsyncSession,
    project_id: int,
    user_id: int,
    report_type: str = "回归报告",
) -> ApiTestReport:
    """基于最近一次完成执行生成报告"""
    project = await get_project(db, project_id)
    result = await db.execute(
        select(ApiExecution)
        .where(ApiExecution.project_id == project_id)
        .where(ApiExecution.status == "完成")
        .order_by(ApiExecution.created_at.desc())
        .limit(1)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise ValueError("该项目暂无完成的执行记录，无法生成报告")

    from datetime import datetime as dt

    now = dt.now()
    report = ApiTestReport(
        project_id=project_id,
        name=f"{project.name}接口测试报告-{now.strftime('%m%d')}",
        report_type=report_type,
        total_cases=execution.total,
        passed=execution.passed,
        pass_rate=execution.pass_rate,
        content={
            "summary": {
                "total": execution.total,
                "passed": execution.passed,
                "failed": execution.failed,
                "pass_rate": execution.pass_rate,
                "duration_ms": execution.duration_ms,
                "completed_at": execution.completed_at.isoformat()
                if execution.completed_at
                else None,
            },
            "results": execution.results,
        },
        created_by=user_id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


async def delete_report(db: AsyncSession, report_id: int):
    """删除报告"""
    result = await db.execute(
        select(ApiTestReport).where(ApiTestReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise ValueError("报告不存在")
    await db.delete(report)
    await db.commit()
