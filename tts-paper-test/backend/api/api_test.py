"""AI接口自动化路由"""

import asyncio
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from database import AsyncSessionLocal, get_db
from models.user import User
from schemas.api_test import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    EnvironmentCreate,
    EnvironmentUpdate,
    EnvironmentResponse,
    EndpointCreate,
    EndpointUpdate,
    EndpointResponse,
    TestCaseCreate,
    TestCaseUpdate,
    TestCaseResponse,
    ExecuteRequest,
    TestExecutionResponse,
    ReportResponse,
)
from schemas.common import ResponseModel
from api.deps import get_current_user_dep
from services import api_test_service as ats
from services.log_service import create_operation_log

router = APIRouter(prefix="/api-test", tags=["AI接口自动化"])

# 后台任务引用持有器（防止 GC，并跟踪进行中的执行任务）
execution_task_holder: dict = {"tasks": set()}


# ════════════ 项目 ════════════


@router.post("/projects", response_model=ResponseModel)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """创建接口测试项目"""
    project = await ats.create_project(db, body, user.id)
    await create_operation_log(
        db,
        module="api-test",
        action="create_project",
        user_id=user.id,
        username=user.username,
        target_id=str(project.id),
        target_type="project",
        detail={"name": project.name, "base_url": project.base_url},
    )
    return ResponseModel(
        message="项目创建成功",
        data=ProjectResponse(
            id=project.id,
            name=project.name,
            base_url=project.base_url,
            description=project.description,
            status=project.status,
            created_by=project.created_by,
            created_at=project.created_at,
            updated_at=project.updated_at,
        ),
    )


@router.get("/projects", response_model=ResponseModel)
async def list_projects(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """项目列表"""
    result = await ats.list_projects(db, user.id, page, page_size, keyword)
    return ResponseModel(data=result)


@router.get("/projects/{project_id}", response_model=ResponseModel)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """项目详情"""
    project = await ats.get_project(db, project_id)
    return ResponseModel(
        data=ProjectResponse(
            id=project.id,
            name=project.name,
            base_url=project.base_url,
            description=project.description,
            status=project.status,
            created_by=project.created_by,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
    )


@router.put("/projects/{project_id}", response_model=ResponseModel)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新项目"""
    project = await ats.update_project(db, project_id, body)
    await create_operation_log(
        db,
        module="api-test",
        action="update_project",
        user_id=user.id,
        username=user.username,
        target_id=str(project_id),
        target_type="project",
    )
    return ResponseModel(
        message="项目已更新",
        data=ProjectResponse(
            id=project.id,
            name=project.name,
            base_url=project.base_url,
            description=project.description,
            status=project.status,
            created_by=project.created_by,
            created_at=project.created_at,
            updated_at=project.updated_at,
        ),
    )


@router.delete("/projects/{project_id}", response_model=ResponseModel)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除项目"""
    await ats.delete_project(db, project_id)
    await create_operation_log(
        db,
        module="api-test",
        action="delete_project",
        user_id=user.id,
        username=user.username,
        target_id=str(project_id),
        target_type="project",
    )
    return ResponseModel(message="项目已删除")


# ════════════ 环境配置 ════════════


@router.get("/environments", response_model=ResponseModel)
async def list_environments(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """环境配置列表"""
    result = await ats.list_environments(db, user.id, page, page_size, keyword)
    return ResponseModel(data=result)


@router.post("/environments", response_model=ResponseModel)
async def create_environment(
    body: EnvironmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """创建环境配置"""
    env = await ats.create_environment(db, body, user.id)
    await create_operation_log(
        db,
        module="api-test",
        action="create_environment",
        user_id=user.id,
        username=user.username,
        target_id=str(env.id),
        target_type="environment",
        detail={"name": env.name},
    )
    return ResponseModel(
        message="环境创建成功",
        data=EnvironmentResponse(
            id=env.id,
            name=env.name,
            base_url=env.base_url,
            auth_type=env.auth_type,
            auth_config=env.auth_config,
            status=env.status,
            created_at=env.created_at,
            updated_at=env.updated_at,
        ),
    )


@router.put("/environments/{env_id}", response_model=ResponseModel)
async def update_environment(
    env_id: int,
    body: EnvironmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新环境配置"""
    env = await ats.update_environment(db, env_id, body)
    return ResponseModel(
        message="环境已更新",
        data=EnvironmentResponse(
            id=env.id,
            name=env.name,
            base_url=env.base_url,
            auth_type=env.auth_type,
            auth_config=env.auth_config,
            status=env.status,
            created_at=env.created_at,
            updated_at=env.updated_at,
        ),
    )


@router.delete("/environments/{env_id}", response_model=ResponseModel)
async def delete_environment(
    env_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除环境配置"""
    await ats.delete_environment(db, env_id)
    await create_operation_log(
        db,
        module="api-test",
        action="delete_environment",
        user_id=user.id,
        username=user.username,
        target_id=str(env_id),
        target_type="environment",
    )
    return ResponseModel(message="环境已删除")


@router.post("/environments/{env_id}/test", response_model=ResponseModel)
async def test_environment(
    env_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """测试环境连接"""
    env = await ats.test_environment_connection(db, env_id)
    return ResponseModel(
        message="连接成功" if env.status == "已连接" else "连接失败",
        data=EnvironmentResponse(
            id=env.id,
            name=env.name,
            base_url=env.base_url,
            auth_type=env.auth_type,
            auth_config=env.auth_config,
            status=env.status,
            created_at=env.created_at,
            updated_at=env.updated_at,
        ),
    )


# ════════════ 接口端点 ════════════


@router.get("/endpoints", response_model=ResponseModel)
async def list_endpoints(
    project_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """接口列表（可按项目过滤）"""
    result = await ats.list_endpoints(db, project_id, user.id, page, page_size, keyword)
    return ResponseModel(data=result)


@router.post("/endpoints", response_model=ResponseModel)
async def create_endpoint(
    body: EndpointCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """创建接口"""
    endpoint = await ats.create_endpoint(db, body, user.id)
    await create_operation_log(
        db,
        module="api-test",
        action="create_endpoint",
        user_id=user.id,
        username=user.username,
        target_id=str(endpoint.id),
        target_type="endpoint",
        detail={"name": endpoint.name, "url": endpoint.url},
    )
    return ResponseModel(
        message="接口创建成功",
        data=EndpointResponse(
            id=endpoint.id,
            project_id=endpoint.project_id,
            name=endpoint.name,
            method=endpoint.method,
            url=endpoint.url,
            headers=endpoint.headers,
            params=endpoint.params,
            body=endpoint.body,
            status=endpoint.status,
            response_time_ms=endpoint.response_time_ms,
            last_checked_at=endpoint.last_checked_at,
            created_at=endpoint.created_at,
        ),
    )


@router.put("/endpoints/{endpoint_id}", response_model=ResponseModel)
async def update_endpoint(
    endpoint_id: int,
    body: EndpointUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新接口"""
    endpoint = await ats.update_endpoint(db, endpoint_id, body)
    return ResponseModel(
        message="接口已更新",
        data=EndpointResponse(
            id=endpoint.id,
            project_id=endpoint.project_id,
            name=endpoint.name,
            method=endpoint.method,
            url=endpoint.url,
            headers=endpoint.headers,
            params=endpoint.params,
            body=endpoint.body,
            status=endpoint.status,
            response_time_ms=endpoint.response_time_ms,
            last_checked_at=endpoint.last_checked_at,
            created_at=endpoint.created_at,
        ),
    )


@router.delete("/endpoints/{endpoint_id}", response_model=ResponseModel)
async def delete_endpoint(
    endpoint_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除接口"""
    await ats.delete_endpoint(db, endpoint_id)
    await create_operation_log(
        db,
        module="api-test",
        action="delete_endpoint",
        user_id=user.id,
        username=user.username,
        target_id=str(endpoint_id),
        target_type="endpoint",
    )
    return ResponseModel(message="接口已删除")


@router.post("/endpoints/{endpoint_id}/test", response_model=ResponseModel)
async def test_endpoint(
    endpoint_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """探测接口可达性"""
    endpoint = await ats.test_endpoint(db, endpoint_id)
    return ResponseModel(
        message="接口探测完成",
        data=EndpointResponse(
            id=endpoint.id,
            project_id=endpoint.project_id,
            name=endpoint.name,
            method=endpoint.method,
            url=endpoint.url,
            headers=endpoint.headers,
            params=endpoint.params,
            body=endpoint.body,
            status=endpoint.status,
            response_time_ms=endpoint.response_time_ms,
            last_checked_at=endpoint.last_checked_at,
            created_at=endpoint.created_at,
        ),
    )


# ════════════ 测试用例 ════════════


@router.get("/test-cases", response_model=ResponseModel)
async def list_test_cases(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """用例列表（可按项目/状态过滤）"""
    result = await ats.list_test_cases(
        db, project_id, user.id, page, page_size, keyword, status
    )
    return ResponseModel(data=result)


@router.post("/test-cases", response_model=ResponseModel)
async def create_test_case(
    body: TestCaseCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """创建测试用例"""
    case = await ats.create_test_case(db, body, user.id)
    await create_operation_log(
        db,
        module="api-test",
        action="create_test_case",
        user_id=user.id,
        username=user.username,
        target_id=str(case.id),
        target_type="test_case",
        detail={"name": case.name},
    )
    return ResponseModel(
        message="用例创建成功",
        data=TestCaseResponse(
            id=case.id,
            project_id=case.project_id,
            endpoint_id=case.endpoint_id,
            name=case.name,
            method=case.method,
            url=case.url,
            expected_status=case.expected_status,
            priority=case.priority,
            status=case.status,
            source=case.source,
            ai_model=case.ai_model,
            last_result=case.last_result,
            created_at=case.created_at,
        ),
    )


@router.put("/test-cases/{case_id}", response_model=ResponseModel)
async def update_test_case(
    case_id: int,
    body: TestCaseUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新测试用例"""
    case = await ats.update_test_case(db, case_id, body)
    return ResponseModel(
        message="用例已更新",
        data=TestCaseResponse(
            id=case.id,
            project_id=case.project_id,
            endpoint_id=case.endpoint_id,
            name=case.name,
            method=case.method,
            url=case.url,
            expected_status=case.expected_status,
            priority=case.priority,
            status=case.status,
            source=case.source,
            ai_model=case.ai_model,
            last_result=case.last_result,
            created_at=case.created_at,
        ),
    )


@router.delete("/test-cases/{case_id}", response_model=ResponseModel)
async def delete_test_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除测试用例"""
    await ats.delete_test_case(db, case_id)
    await create_operation_log(
        db,
        module="api-test",
        action="delete_test_case",
        user_id=user.id,
        username=user.username,
        target_id=str(case_id),
        target_type="test_case",
    )
    return ResponseModel(message="用例已删除")


# ════════════ 执行 ════════════


@router.get("/executions", response_model=ResponseModel)
async def list_executions(
    project_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """执行记录列表"""
    result = await ats.list_executions(db, project_id, user.id, page, page_size)
    return ResponseModel(data=result)


@router.get("/executions/{execution_id}", response_model=ResponseModel)
async def get_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """执行记录详情"""
    execution = await ats.get_execution(db, execution_id)
    return ResponseModel(
        data=TestExecutionResponse(
            id=execution.id,
            project_id=execution.project_id,
            name=execution.name,
            case_ids=execution.case_ids,
            total=execution.total,
            passed=execution.passed,
            failed=execution.failed,
            pass_rate=execution.pass_rate,
            status=execution.status,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            duration_ms=execution.duration_ms,
            results=execution.results,
            error_message=execution.error_message,
            created_at=execution.created_at,
        ),
    )


@router.post("/projects/{project_id}/execute", response_model=ResponseModel)
async def execute_tests(
    project_id: int,
    body: Optional[ExecuteRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """启动接口测试执行（后台真实请求，逐用例执行）"""
    case_ids = body.case_ids if body else None
    execution = await ats.create_execution(db, project_id, case_ids, user.id)

    # 创建独立任务，避免阻塞请求（防止事件循环被长时间占用）
    # 注意：必须使用独立 session——请求级 db 在响应返回后即进入 prepared/closed 状态
    async def _run():
        async with AsyncSessionLocal() as session:
            try:
                await ats.run_execution(session, execution.id)
            except Exception as e:  # noqa: BLE001
                logger.exception(f"后台执行异常: {e}")

    task = asyncio.create_task(_run())
    # 保存任务引用防止被 GC（任务自行持有 db session 引用）
    execution_task_holder["tasks"].add(task)
    task.add_done_callback(lambda t: execution_task_holder["tasks"].discard(t))

    await create_operation_log(
        db,
        module="api-test",
        action="execute_tests",
        user_id=user.id,
        username=user.username,
        target_id=str(project_id),
        target_type="project",
        detail={"execution_id": execution.id, "case_ids": case_ids},
    )
    return ResponseModel(
        message="测试执行已启动",
        data=TestExecutionResponse(
            id=execution.id,
            project_id=execution.project_id,
            name=execution.name,
            case_ids=execution.case_ids,
            total=execution.total,
            passed=execution.passed,
            failed=execution.failed,
            pass_rate=execution.pass_rate,
            status=execution.status,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            duration_ms=execution.duration_ms,
            results=execution.results,
            error_message=execution.error_message,
            created_at=execution.created_at,
        ),
    )


# ════════════ 报告 ════════════


@router.get("/reports", response_model=ResponseModel)
async def list_reports(
    project_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """报告列表"""
    result = await ats.list_reports(db, project_id, user.id, page, page_size, keyword)
    return ResponseModel(data=result)


@router.post("/reports/generate", response_model=ResponseModel)
async def generate_report(
    body: Optional[dict] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """基于最近完成执行生成报告 gen={project_id, report_type}"""
    body = body or {}
    project_id = body.get("project_id")
    if not project_id:
        raise ValueError("缺少 project_id 参数")
    report_type = body.get("report_type", "回归报告")
    report = await ats.generate_report(db, project_id, user.id, report_type)
    await create_operation_log(
        db,
        module="api-test",
        action="generate_report",
        user_id=user.id,
        username=user.username,
        target_id=str(report.id),
        target_type="report",
        detail={"name": report.name},
    )
    return ResponseModel(
        message="报告生成成功",
        data=ReportResponse(
            id=report.id,
            project_id=report.project_id,
            name=report.name,
            report_type=report.report_type,
            total_cases=report.total_cases,
            passed=report.passed,
            pass_rate=report.pass_rate,
            content=report.content,
            created_at=report.created_at,
            updated_at=report.updated_at,
        ),
    )


@router.delete("/reports/{report_id}", response_model=ResponseModel)
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除报告"""
    await ats.delete_report(db, report_id)
    await create_operation_log(
        db,
        module="api-test",
        action="delete_report",
        user_id=user.id,
        username=user.username,
        target_id=str(report_id),
        target_type="report",
    )
    return ResponseModel(message="报告已删除")
