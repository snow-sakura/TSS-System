"""Web自动化路由"""

import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from schemas.web_automation import (
    ProjectCreate, ProjectResponse, PageResponse,
    TestCaseCreate, TestCaseUpdate, TestCaseResponse,
    ExecutionResponse,
)
from schemas.common import ResponseModel
from api.deps import get_current_user_dep
from services import web_automation_service as was
from services.log_service import create_operation_log
from config import get_settings

router = APIRouter(prefix="/web-automation", tags=["Web自动化测试"])


# ============ 项目管理 ============

@router.post("/projects", response_model=ResponseModel)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """创建自动化项目"""
    project = await was.create_project(db, body, user.id)
    await create_operation_log(
        db, module="web-automation", action="create_project",
        user_id=user.id, username=user.username,
        target_id=str(project.id), target_type="project",
        detail={"name": project.name, "url": project.target_url},
    )
    return ResponseModel(
        message="项目创建成功",
        data=ProjectResponse(
            id=project.id, name=project.name, target_url=project.target_url,
            description=project.description, status=project.status,
            created_by=project.created_by, created_at=project.created_at,
            updated_at=project.updated_at,
        ),
    )


@router.get("/projects", response_model=ResponseModel)
async def list_projects(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """项目列表"""
    result = await was.list_projects(db, user.id, page, page_size)
    return ResponseModel(data=result)


@router.get("/projects/{project_id}", response_model=ResponseModel)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """项目详情"""
    project = await was.get_project(db, project_id)
    return ResponseModel(
        data=ProjectResponse(
            id=project.id, name=project.name, target_url=project.target_url,
            description=project.description, status=project.status,
            created_by=project.created_by, created_at=project.created_at,
            updated_at=project.updated_at,
        )
    )


@router.delete("/projects/{project_id}", response_model=ResponseModel)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除项目"""
    await was.delete_project(db, project_id)
    await create_operation_log(
        db, module="web-automation", action="delete_project",
        user_id=user.id, username=user.username,
        target_id=str(project_id), target_type="project",
    )
    return ResponseModel(message="项目已删除")


# ============ AI探索 ============

@router.post("/projects/{project_id}/explore")
async def start_exploration(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """启动AI探索 - 返回SSE事件流"""
    # 获取项目
    project = await was.get_project(db, project_id)

    # 更新状态
    await was.update_project_status(db, project_id, "exploring")

    await create_operation_log(
        db, module="web-automation", action="explore",
        user_id=user.id, username=user.username,
        target_id=str(project_id), target_type="project",
    )

    return StreamingResponse(
        _run_exploration(project_id, project.target_url, user.id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_exploration(project_id: int, target_url: str, user_id: int):
    """后台执行AI探索（SSE事件流）"""
    from agents.web_explorer import WebExplorerAgent
    from database import AsyncSessionLocal

    settings = get_settings()
    agent = WebExplorerAgent(
        model_name=settings.MIDSCENE_MODEL_NAME,
        api_key=settings.MIDSCENE_MODEL_API_KEY,
        base_url=settings.MIDSCENE_MODEL_BASE_URL,
        model_family=settings.MIDSCENE_MODEL_FAMILY,
    )

    # SSE事件发送
    def event(event_type: str, data: dict) -> str:
        return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    try:
        yield event("exploration_start", {"project_id": project_id, "target_url": target_url})

        # 额度监控：记录API调用次数
        api_call_count = 0
        MAX_API_CALLS = 10  # 免费额度限制

        # 进度回调
        async def progress_callback(msg: dict):
            nonlocal api_call_count
            
            # 检查是否是API调用事件
            if msg.get("type") == "page_analyzed":
                api_call_count += 1
                if api_call_count >= MAX_API_CALLS:
                    await callback({"type": "status", "message": f"已达到免费额度限制 ({MAX_API_CALLS}次调用)，停止探索"})
                    raise Exception(f"免费额度已用完（已调用{api_call_count}次API），请充值后重试")
            
            # 检查错误消息中的额度相关错误
            error_msg = msg.get("message", "") or msg.get("error", "")
            if any(keyword in error_msg.lower() for keyword in ["quota", "limit", "billing", "payment", "insufficient", "余额", "额度"]):
                await callback({"type": "status", "message": "检测到额度不足，停止探索"})
                raise Exception(f"API额度不足: {error_msg}")
            
            # 广播到WebSocket
            await broadcast_to_project(project_id, msg)
            # 保存页面到数据库（如果是页面分析完成）
            if msg.get("type") == "page_analyzed":
                async with AsyncSessionLocal() as db:
                    await was.create_page(db, project_id, msg)

        # 执行探索
        result = await agent.explore(target_url, callback=progress_callback)

        # 保存探索结果
        async with AsyncSessionLocal() as db:
            for page_data in result.get("pages", []):
                await was.create_page(db, project_id, page_data)

            # 更新项目状态
            await was.update_project_status(db, project_id, "explored")

        yield event("exploration_complete", {
            "project_id": project_id,
            "total_pages": len(result.get("pages", [])),
            "pages": result.get("pages", []),
        })

    except Exception as e:
        from loguru import logger
        logger.error(f"探索失败: {e}")

        async with AsyncSessionLocal() as db:
            await was.update_project_status(db, project_id, "failed")

        yield event("exploration_error", {
            "project_id": project_id,
            "error": str(e),
        })


@router.get("/projects/{project_id}/pages")
async def list_pages(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """探索到的页面列表"""
    pages = await was.list_pages(db, project_id)
    return ResponseModel(
        data=[PageResponse.model_validate(p) for p in pages]
    )


# ============ 测试用例 ============

@router.post("/projects/{project_id}/generate")
async def generate_test_cases(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """AI生成测试用例 - 返回SSE事件流"""
    # 获取项目
    project = await was.get_project(db, project_id)

    # 获取探索到的页面
    pages = await was.list_pages(db, project_id)
    if not pages:
        return ResponseModel(
            success=False,
            message="请先执行AI探索，获取页面结构后再生成测试用例",
        )

    await create_operation_log(
        db, module="web-automation", action="generate_cases",
        user_id=user.id, username=user.username,
        target_id=str(project_id), target_type="project",
    )

    return StreamingResponse(
        _run_generation(project_id, project.target_url, pages, user.id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_generation(project_id: int, target_url: str, pages: list, user_id: int):
    """后台执行测试用例生成（SSE事件流）"""
    from agents.test_generator import TestGeneratorAgent
    from database import AsyncSessionLocal

    settings = get_settings()
    agent = TestGeneratorAgent(
        model_name=settings.DEFAULT_LLM_MODEL,
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
    )

    def event(event_type: str, data: dict) -> str:
        return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    try:
        yield event("generation_start", {"project_id": project_id})

        # 准备页面结构数据
        page_structure = pages[0].page_map if pages and pages[0].page_map else {}
        pages_data = [{"url": p.url, "title": p.title} for p in pages]

        yield event("status", {"message": "正在分析页面结构..."})

        # 生成测试用例
        test_cases = await agent.generate(
            url=target_url,
            page_structure=page_structure,
            pages=pages_data,
        )

        yield event("status", {"message": f"已生成 {len(test_cases)} 条测试用例"})

        # 保存到数据库
        async with AsyncSessionLocal() as db:
            created = await was.create_test_cases_from_ai(
                db, project_id, test_cases, agent.model_name
            )

        yield event("generation_complete", {
            "project_id": project_id,
            "total": len(test_cases),
            "cases": test_cases,
        })

    except Exception as e:
        from loguru import logger
        logger.error(f"测试用例生成失败: {e}")
        yield event("generation_error", {
            "project_id": project_id,
            "error": str(e),
        })


@router.get("/projects/{project_id}/test-cases")
async def list_test_cases(
    project_id: int,
    status: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """测试用例列表"""
    cases = await was.list_test_cases(db, project_id, status)
    return ResponseModel(
        data=[TestCaseResponse.model_validate(c) for c in cases]
    )


@router.put("/test-cases/{case_id}")
async def update_test_case(
    case_id: int,
    body: TestCaseUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """编辑测试用例"""
    from sqlalchemy import select
    from models.web_automation import WebTestCase
    result = await db.execute(select(WebTestCase).where(WebTestCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="测试用例不存在")

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(case, k, v)
    await db.commit()
    await db.refresh(case)
    return ResponseModel(message="更新成功", data=TestCaseResponse.model_validate(case))


@router.post("/test-cases/{case_id}/approve")
async def approve_test_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """确认测试用例"""
    case = await was.approve_test_case(db, case_id, user.id)
    await create_operation_log(
        db, module="web-automation", action="approve_case",
        user_id=user.id, username=user.username,
        target_id=str(case_id), target_type="test_case",
    )
    return ResponseModel(message="已确认", data=TestCaseResponse.model_validate(case))


@router.post("/test-cases/{case_id}/reject")
async def reject_test_case(
    case_id: int,
    note: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """驳回测试用例"""
    case = await was.reject_test_case(db, case_id, user.id, note)
    return ResponseModel(message="已驳回", data=TestCaseResponse.model_validate(case))


# ============ 执行 ============

@router.get("/executions")
async def list_executions(
    project_id: int = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """执行记录列表"""
    result = await was.list_executions(db, project_id, page, page_size)
    # 转换为Pydantic模型
    items = result.get("items", [])
    serialized_items = [ExecutionResponse.model_validate(item) for item in items]
    return ResponseModel(data={"items": serialized_items, "total": result.get("total", 0)})


@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """执行记录详情"""
    execution = await was.get_execution(db, execution_id)
    return ResponseModel(data=ExecutionResponse.model_validate(execution))


@router.post("/projects/{project_id}/execute")
async def start_execution(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """启动Web自动化测试执行"""
    # 获取项目
    project = await was.get_project(db, project_id)

    # 获取已审批的测试用例
    from sqlalchemy import select
    from models.web_automation import WebTestCase
    result = await db.execute(
        select(WebTestCase)
        .where(WebTestCase.project_id == project_id, WebTestCase.status == "approved")
        .order_by(WebTestCase.id)
    )
    approved_cases = result.scalars().all()

    if not approved_cases:
        return ResponseModel(
            message="没有已审批的测试用例，请先审批用例",
            data={"project_id": project_id, "cases_count": 0},
        )

    # 更新项目状态
    await was.update_project_status(db, project_id, "executing")

    # 创建执行记录
    case_ids = [c.id for c in approved_cases]
    execution = await was.create_execution(db, project_id, case_ids, user.id)

    # 准备测试用例数据
    test_cases = []
    for case in approved_cases:
        steps = case.steps if isinstance(case.steps, list) else []
        test_cases.append({
            "id": case.id,
            "title": case.title or f"测试用例 {case.id}",
            "steps": steps,
            "page_url": project.target_url,
        })

    # 异步启动执行引擎
    asyncio.create_task(_run_execution(project_id, execution.id, test_cases, user.id))

    return ResponseModel(
        message="测试执行已启动",
        data={
            "project_id": project_id,
            "execution_id": execution.id,
            "cases_count": len(approved_cases),
            "status": "executing",
        },
    )


async def _run_execution(project_id: int, execution_id: int, test_cases: list[dict], user_id: int):
    """后台执行测试（异步任务）"""
    from agents.execution_agent import ExecutionAgent
    from config import get_settings

    settings = get_settings()
    agent = ExecutionAgent(
        model_name=settings.MIDSCENE_MODEL_NAME,
        api_key=settings.MIDSCENE_MODEL_API_KEY,
        base_url=settings.MIDSCENE_MODEL_BASE_URL,
        model_family=settings.MIDSCENE_MODEL_FAMILY,
    )

    # WebSocket回调
    async def ws_callback(event: dict):
        await broadcast_to_project(project_id, event)

    try:
        # 更新执行状态为running
        from database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await was.update_execution(db, execution_id, {"status": "running"})

        # 执行测试
        results = await agent.run(project_id, test_cases, callback=ws_callback)

        # 统计结果
        passed = sum(1 for r in results if r.get("status") == "passed")
        failed = sum(1 for r in results if r.get("status") == "failed")
        total_duration = sum(r.get("duration_ms", 0) for r in results)
        screenshots = [r.get("screenshot", "") for r in results if r.get("screenshot")]
        errors = [r.get("error", "") for r in results if r.get("error")]

        final_status = "completed" if failed == 0 else "failed"

        # 更新执行记录
        from datetime import datetime, timezone
        async with AsyncSessionLocal() as db:
            await was.update_execution(db, execution_id, {
                "status": final_status,
                "completed_at": datetime.now(timezone.utc),
                "duration_ms": total_duration,
                "screenshots": screenshots,
                "error_message": "\n".join(errors) if errors else None,
            })

        # 更新项目状态
        async with AsyncSessionLocal() as db:
            await was.update_project_status(db, project_id, "completed")

        # 广播完成事件
        await broadcast_to_project(project_id, {
            "type": "execution_complete",
            "execution_id": execution_id,
            "status": final_status,
            "passed": passed,
            "failed": failed,
            "total": len(test_cases),
            "duration_ms": total_duration,
        })

    except Exception as e:
        from loguru import logger
        logger.error(f"执行失败: {e}")
        from database import AsyncSessionLocal
        from datetime import datetime, timezone
        async with AsyncSessionLocal() as db:
            await was.update_execution(db, execution_id, {
                "status": "failed",
                "completed_at": datetime.now(timezone.utc),
                "error_message": str(e),
            })
            await was.update_project_status(db, project_id, "failed")

        await broadcast_to_project(project_id, {
            "type": "execution_error",
            "execution_id": execution_id,
            "error": str(e),
        })


# ============ WebSocket实时推送 ============

connected_clients: dict[int, list[WebSocket]] = {}


@router.websocket("/ws/automation/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: int):
    """WebSocket实时推送探索/执行进度"""
    await websocket.accept()

    if project_id not in connected_clients:
        connected_clients[project_id] = []
    connected_clients[project_id].append(websocket)

    try:
        while True:
            # 保持连接，接收客户端心跳
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        connected_clients[project_id].remove(websocket)
        if not connected_clients[project_id]:
            del connected_clients[project_id]


@router.get("/projects-for-workflow", summary="获取项目列表（工作流配置用）")
async def list_projects_for_workflow(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """返回精简的项目列表，用于工作流节点配置下拉选择"""
    result = await was.list_projects(db, user.id, page=1, page_size=100)
    items = result.get("items", []) if isinstance(result, dict) else []
    return ResponseModel(
        data=[{"id": p.id, "name": p.name, "target_url": p.target_url, "status": p.status} for p in items]
    )


async def broadcast_to_project(project_id: int, message: dict):
    """向项目的所有连接客户端广播消息"""
    if project_id in connected_clients:
        disconnected = []
        for ws in connected_clients[project_id]:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            connected_clients[project_id].remove(ws)
