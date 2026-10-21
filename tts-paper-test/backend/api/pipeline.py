"""全流程 Pipeline API — DB 版 + 执行解耦（SPEC-001）

关键设计：
- 执行由独立 asyncio 任务驱动（_pump），SSE 端点仅是"订阅者"
- 客户端断开只结束订阅，不终止后端执行 → 结果零丢失
- 事件带序号缓冲，支持 since 游标重放（刷新页面后可重连接续传）
"""

import asyncio
import json
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from database import AsyncSessionLocal, get_db
from services.pipeline_service import PipelineService
from sqlalchemy.ext.asyncio import AsyncSession
from core.logging_config import get_logger
from api.deps import get_current_user_dep
from models.user import User

logger = get_logger("pipeline_api")
router = APIRouter(prefix="/api/v1/pipeline", tags=["全流程Pipeline"])

# 已完成运行状态的保留时长（秒），超时后清理内存缓冲
RUN_RETENTION_SECONDS = 30 * 60


class PipelineRunState:
    """一次 Pipeline 运行的内存态：事件缓冲 + 订阅通知"""

    def __init__(self, run_key: str, requirement_name: str):
        self.run_key = run_key
        self.record_id: Optional[int] = None
        self.requirement_name = requirement_name
        self.events: list[tuple[str, dict]] = []
        self.done = False
        self.cancelled = False
        self.started_at = time.time()
        self.completed_at: Optional[float] = None
        self.cond = asyncio.Condition()
        self.task: Optional[asyncio.Task] = None

    async def push(self, event: str, data: dict):
        async with self.cond:
            self.events.append((event, data))
            self.cond.notify_all()

    async def finish(self):
        async with self.cond:
            self.done = True
            self.completed_at = time.time()
            self.cond.notify_all()

    def snapshot(self) -> dict:
        return {
            "run_key": self.run_key,
            "record_id": self.record_id,
            "requirement_name": self.requirement_name,
            "done": self.done,
            "cancelled": self.cancelled,
            "event_count": len(self.events),
            "started_at": self.started_at,
        }


# 运行注册表：run_key -> state；record_id -> state（回调后注册）
RUNS: dict[str, PipelineRunState] = {}
RUNS_BY_RECORD: dict[int, PipelineRunState] = {}


def _purge_finished_runs():
    now = time.time()
    expired = [
        k
        for k, s in RUNS.items()
        if s.done and s.completed_at and now - s.completed_at > RUN_RETENTION_SECONDS
    ]
    for k in expired:
        state = RUNS.pop(k, None)
        if state and state.record_id:
            RUNS_BY_RECORD.pop(state.record_id, None)


async def _pump_run(state: PipelineRunState, body: "PipelineStartRequest"):
    """后台驱动 PipelineService 执行，将事件推入缓冲（独立 session，与请求生命周期解耦）"""
    async with AsyncSessionLocal() as session:

        def _on_record_created(record_id: int):
            state.record_id = record_id
            RUNS_BY_RECORD[record_id] = state
            # 同步一个 record_created 事件给前端（用于重连定位）
            asyncio.ensure_future(
                state.push("record_created", {"record_id": record_id})
            )

        service = PipelineService(db=session)
        try:
            stream = service.run_pipeline(
                requirement_content=body.requirement_content,
                requirement_name=body.requirement_name,
                project_id=body.project_id,
                version_id=body.version_id,
                resume_from=body.resume_from,
                record_id=body.record_id,
                sequence_group_id=body.sequence_group_id,
                sequence_lane=body.sequence_lane,
                on_record_created=_on_record_created,
            )
            async for raw_event in stream:
                if state.cancelled:
                    logger.warning(f"⏹ Pipeline 运行 {state.run_key} 被用户取消")
                    break
                event, data = _parse_sse_chunk(raw_event)
                if event:
                    await state.push(event, data)
        except asyncio.CancelledError:
            logger.warning(f"⏹ Pipeline 运行 {state.run_key} 任务被取消")
            state.cancelled = True
        except Exception as e:
            logger.error(f"❌ Pipeline pump 异常: {e}")
            await state.push(
                "pipeline_complete",
                {"status": "failed", "error": str(e)[:300]},
            )
        finally:
            await state.finish()
            # 取消收尾：把仍处 running 的记录标为 cancelled
            if state.cancelled and state.record_id:
                try:
                    from models.test_lifecycle import PipelineRecord

                    rec = await session.get(PipelineRecord, state.record_id)
                    if rec and rec.status == "running":
                        rec.status = "cancelled"
                        await session.commit()
                except Exception as ce:
                    logger.error(f"取消状态写回失败: {ce}")


def _parse_sse_chunk(raw: str) -> tuple[Optional[str], dict]:
    """解析 'event: x\ndata: {...}\n\n' 为 (event, data)"""
    event = None
    data: dict = {}
    for line in raw.splitlines():
        if line.startswith("event: "):
            event = line[7:].strip()
        elif line.startswith("data: "):
            try:
                data = json.loads(line[6:])
            except json.JSONDecodeError:
                data = {}
    return event, data


async def _stream_state(state: PipelineRunState, since: int = 0):
    """SSE 订阅生成器：先重放 since 之后的事件，再实时订阅直至完成"""
    idx = max(0, since)
    heartbeat_every = 20.0
    while True:
        async with state.cond:
            while idx >= len(state.events) and not state.done:
                try:
                    await asyncio.wait_for(state.cond.wait(), timeout=heartbeat_every)
                except asyncio.TimeoutError:
                    break  # 发心跳
            batch = state.events[idx:]
            idx = len(state.events)
            done = state.done
        if not batch:
            if done:
                break
            yield ": keep-alive\n\n"
            continue
        for event, data in batch:
            yield f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        if done:
            break


class PipelineStartRequest(BaseModel):
    """启动全流程请求"""

    requirement_content: str = Field(
        ..., description="需求文档内容/手动输入文本", min_length=1, max_length=100000
    )
    requirement_name: str = Field(default="", description="需求名称")
    project_id: Optional[int] = Field(default=None, description="项目ID")
    version_id: Optional[int] = Field(default=None, description="版本ID")
    resume_from: Optional[str] = Field(
        default=None, description="从指定阶段继续执行（阶段key）"
    )
    record_id: Optional[int] = Field(
        default=None, description="追加到原记录ID（继续执行模式）"
    )
    sequence_group_id: Optional[int] = Field(
        default=None, description="序列调度组ID（由 sequence API 注入）"
    )
    sequence_lane: Optional[int] = Field(
        default=None, description="并行通道号（由 sequence API 注入）"
    )


@router.post("/start")
async def start_pipeline(
    body: PipelineStartRequest,
    user: User = Depends(get_current_user_dep),
):
    """
    启动全流程Pipeline（需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审）

    - 返回 SSE 事件流；执行在独立任务中进行，客户端断开不影响结果落库
    - 支持继续执行模式：resume_from + record_id
    - 首个 record_created 事件携带 record_id，可用 /runs/{record_id}/stream 重连
    """
    if not body.requirement_content.strip():
        raise HTTPException(status_code=400, detail="需求内容不能为空")

    # 启动前探活：模型/key 不可用时立即明确报错（避免整轮静默失败）
    probe = await PipelineService().check_model_available()
    if not probe["available"]:
        raise HTTPException(status_code=424, detail=probe["reason"])

    _purge_finished_runs()

    run_key = uuid.uuid4().hex[:12]
    state = PipelineRunState(run_key, body.requirement_name or "未命名需求")
    RUNS[run_key] = state
    if body.record_id:
        RUNS_BY_RECORD[body.record_id] = state

    state.task = asyncio.create_task(_pump_run(state, body))
    logger.info(
        f"🚀 启动全流程Pipeline run={run_key}: {body.requirement_name or '未命名'}"
        + (
            f" (继续执行 record={body.record_id} from={body.resume_from})"
            if body.resume_from
            else ""
        )
    )

    return StreamingResponse(
        _stream_state(state, since=0),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Run-Key": run_key,
        },
    )


@router.get("/runs/{record_id}/stream")
async def reconnect_stream(
    record_id: int,
    since: int = 0,
    user: User = Depends(get_current_user_dep),
):
    """重连指定 Pipeline 记录的实时事件流（since=事件游标，0 表示全量重放）"""
    state = RUNS_BY_RECORD.get(record_id)
    if not state:
        raise HTTPException(
            status_code=404, detail="该记录当前没有进行中的运行（可能已完成）"
        )
    return StreamingResponse(
        _stream_state(state, since=since),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/active")
async def list_active_runs(user: User = Depends(get_current_user_dep)):
    """列出当前所有运行中的 Pipeline（用于前端恢复视图）"""
    _purge_finished_runs()
    return {
        "data": [s.snapshot() for s in RUNS.values() if not s.done],
    }


@router.post("/runs/{record_id}/cancel")
async def cancel_run(record_id: int, user: User = Depends(get_current_user_dep)):
    """取消进行中的 Pipeline 运行（已完成阶段保留，状态置为 cancelled）"""
    state = RUNS_BY_RECORD.get(record_id)
    if not state:
        raise HTTPException(status_code=404, detail="该记录当前没有进行中的运行")
    state.cancelled = True
    if state.task and not state.task.done():
        state.task.cancel()
    return {"data": state.snapshot()}


@router.get("/records/{record_id}/status")
async def run_status(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """查询记录的执行态（结合内存运行状态）"""
    from models.test_lifecycle import PipelineRecord

    rec = await db.get(PipelineRecord, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="记录不存在")
    state = RUNS_BY_RECORD.get(record_id)
    return {
        "data": {
            "record_id": rec.id,
            "status": rec.status,
            "live": bool(state and not state.done),
            "event_count": state.snapshot()["event_count"] if state else 0,
        }
    }
