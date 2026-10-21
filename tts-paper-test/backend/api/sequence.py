"""序列执行调度 API — SPEC-001

- GET  /api/v1/sequence/mode          当前档位与执行模式
- POST /api/v1/sequence/runs          创建并启动序列调度组
- GET  /api/v1/sequence/runs          历史列表（DB + 运行中合并）
- GET  /api/v1/sequence/runs/{id}     快照
- GET  /api/v1/sequence/runs/{id}/stream?since=   SSE（重放+订阅）
- POST /api/v1/sequence/runs/{id}/cancel          取消
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_dep
from core.logging_config import get_logger
from database import get_db
from models.sequence import SequenceGroup
from models.user import User
from services import sequence_scheduler as scheduler

logger = get_logger("sequence_api")
router = APIRouter(prefix="/api/v1/sequence", tags=["序列执行调度"])


class SequenceTaskIn(BaseModel):
    requirement_name: str = Field(default="", max_length=500)
    requirement_content: str = Field(..., min_length=1, max_length=100000)
    project_id: Optional[int] = None
    version_id: Optional[int] = None


class SequenceRunIn(BaseModel):
    name: str = Field(default="", max_length=500, description="调度组名称")
    simulated: bool = Field(default=False, description="模拟执行(demo)：不调用真实LLM")
    project_id: Optional[int] = None
    version_id: Optional[int] = None
    tasks: list[SequenceTaskIn] = Field(..., min_length=1, max_length=20)


@router.get("/mode")
async def get_execution_mode(
    probe: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """当前模型档位与执行模式（免费=单任务串行 / 付费=并行×N）

    probe=true 时附加模型可用性探测（30 秒缓存），用于前端健康徽标。
    """
    mode = await scheduler.resolve_execution_mode(db)
    if probe:
        mode["health"] = await _cached_probe()
    return {"data": mode}


_PROBE_CACHE: dict = {"ts": 0.0, "result": None}


async def _cached_probe() -> dict:
    import time as _time

    from services.pipeline_service import PipelineService

    now = _time.time()
    if now - _PROBE_CACHE["ts"] < 30 and _PROBE_CACHE["result"] is not None:
        return _PROBE_CACHE["result"]
    result = await PipelineService().check_model_available()
    _PROBE_CACHE.update({"ts": now, "result": result})
    return result


@router.post("/runs")
async def create_run(
    body: SequenceRunIn,
    user: User = Depends(get_current_user_dep),
):
    """创建并启动一个序列调度组"""
    # 真实模式：启动前探活，模型不可用直接明确报错
    if not body.simulated:
        from services.pipeline_service import PipelineService

        probe = await PipelineService().check_model_available()
        if not probe["available"]:
            raise HTTPException(
                status_code=424,
                detail=probe["reason"] + "（可在提交时勾选「模拟执行」演示调度流程）",
            )

    snapshot = await scheduler.start_group(
        name=body.name,
        raw_tasks=[t.model_dump() for t in body.tasks],
        simulated=body.simulated,
        created_by=user.id,
        project_id=body.project_id,
        version_id=body.version_id,
    )
    return {"data": snapshot}


@router.get("/runs")
async def list_runs(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """调度组列表：运行中(内存态) + 历史(DB)"""
    from sqlalchemy import func

    total = (
        await db.execute(select(func.count()).select_from(SequenceGroup))
    ).scalar() or 0
    result = await db.execute(
        select(SequenceGroup)
        .order_by(SequenceGroup.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    seen = set()
    for g in result.scalars().all():
        seen.add(g.id)
        rt = scheduler.GROUPS.get(g.id)
        if rt and not rt.done:
            items.append(rt.snapshot())
        else:
            items.append(
                {
                    "id": g.id,
                    "name": g.name,
                    "status": g.status,
                    "mode": g.mode,
                    "tier": g.tier,
                    "concurrency": g.concurrency,
                    "model": g.model,
                    "simulated": g.simulated,
                    "total_tasks": g.total_tasks,
                    "done_tasks": g.done_tasks,
                    "failed_tasks": g.failed_tasks,
                    "tasks": g.tasks or [],
                    "total_duration": g.total_duration,
                    "created_at": g.created_at.isoformat() if g.created_at else None,
                }
            )
    # 补充未入库的刚启动运行（极端时序兜底）
    for rt in scheduler.GROUPS.values():
        if rt.group_id not in seen and not rt.done:
            items.insert(0, rt.snapshot())
    return {
        "data": {
            "items": items,
            "total": max(total, len(items)),
            "page": page,
            "page_size": page_size,
        }
    }


@router.get("/runs/{group_id}")
async def get_run(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """调度组快照：运行中读内存态，否则读 DB"""
    rt = scheduler.GROUPS.get(group_id)
    if rt:
        return {"data": rt.snapshot()}
    g = await db.get(SequenceGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="调度组不存在")
    return {
        "data": {
            "id": g.id,
            "name": g.name,
            "status": g.status,
            "mode": g.mode,
            "tier": g.tier,
            "concurrency": g.concurrency,
            "model": g.model,
            "simulated": g.simulated,
            "total_tasks": g.total_tasks,
            "done_tasks": g.done_tasks,
            "failed_tasks": g.failed_tasks,
            "tasks": g.tasks or [],
            "total_duration": g.total_duration,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
    }


@router.get("/runs/{group_id}/stream")
async def stream_run(
    group_id: int,
    since: int = 0,
    user: User = Depends(get_current_user_dep),
):
    """SSE 事件流（支持 since 断点重放）"""
    rt = scheduler.GROUPS.get(group_id)
    if not rt:
        raise HTTPException(
            status_code=404, detail="调度组不在运行中（可查看历史记录）"
        )
    return StreamingResponse(
        scheduler.stream_group(rt, since=since),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{group_id}/cancel")
async def cancel_run(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """取消调度组（排队中任务不再执行，运行中任务尽力终止）"""
    rt = scheduler.GROUPS.get(group_id)
    if not rt or rt.done:
        raise HTTPException(status_code=404, detail="调度组不在运行中")
    rt.cancelled = True
    for t in rt.tasks:
        if t["status"] in ("queued", "waiting_slot"):
            t["status"] = "cancelled"
    return {"data": rt.snapshot()}
