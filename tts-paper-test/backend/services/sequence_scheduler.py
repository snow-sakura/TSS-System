"""
序列执行调度器 — SPEC-001 核心新增

规则：
- 免费模型（tier=free）  → 单任务序列：并发度 1，任务按提交顺序串行执行
- 付费模型（tier=paid）  → 并行序列：并发度 N（默认3），多条序列同时执行，
                           每条序列内部仍严格按 5 阶段顺序（上下文依赖）

实现：
- 每个任务 = 一次完整 PipelineService.run_pipeline（或 simulated 演示执行）
- 事件缓冲 + since 游标重放，客户端断开不影响调度
"""

import asyncio
import json
import time
from typing import Optional

from sqlalchemy import select

from config import get_settings
from core.logging_config import get_logger
from database import AsyncSessionLocal
from models.config import LLMProvider
from models.sequence import SequenceGroup
from services.pipeline_service import PipelineService, STAGES

logger = get_logger("sequence_scheduler")

RUN_RETENTION_SECONDS = 30 * 60

# 模拟模式的演示输出（用于 demo/验证，不调用真实 LLM）
SIMULATED_STAGE_OUTPUTS = {
    "requirements": "## 📋 需求概述\n\n本需求描述了一个{scope}，目标是为测试团队提供完整的功能验证依据。\n\n## 🎯 功能点分析\n\n| 功能点 | 描述 | 优先级 | 分类 | 隐含推断 |\n|--------|------|--------|------|----------|\n| FP-1 | 核心业务流程 | P0 | 核心功能 | 否 |\n| FP-2 | 异常处理机制 | P1 | 辅助功能 | 是-基于错误推测 |\n\n## 📝 业务规则\n\n1. **规则1**: 输入必须通过格式校验\n2. **规则2**: 状态流转必须合法\n\n## ✅ 验收标准\n\n| 序号 | 验收条件 | 验证方法 | 优先级 |\n|------|---------|---------|--------|\n| AC-001 | 正常流程返回预期结果 | 功能测试 | P0 |\n",
    "test-plans": "## 📋 测试策略概述\n\n采用分层策略：接口层为主、UI 层关键路径为辅，AI 辅助生成边界数据。\n\n## 🎯 测试范围与AI增强\n\n| 范围类型 | 包含/排除 | 说明 | AI增强方式 |\n|---------|-----------|------|-----------|\n| 功能测试 | ✅ | 全功能覆盖 | AI用例生成 |\n| 异常测试 | ✅ | 边界与容错 | AI生成异常数据 |\n\n## 📅 资源与进度估算\n\n预计 3 人日，AI 可节省约 40% 设计工作量。\n",
    "test-points": "## 📋 测试点总览\n\n共提取 12 个测试点，覆盖功能/流程/边界/异常四类场景。\n\n## 🔍 功能测试点\n\n| 编号 | 测试点 | 对应功能 | 优先级 | 测试类型 | 设计技术 | AI增强 |\n|------|--------|---------|--------|---------|---------|--------|\n| TP-001 | 正常提交成功 | FP-1 | P0 | 功能 | 等价类 | 自动 |\n| TP-002 | 必填项为空 | FP-1 | P0 | 异常 | 错误推测 | 自动 |\n| TP-003 | 超长输入 | FP-1 | P1 | 边界 | 边界值 | 自动 |\n| TP-004 | 状态非法流转 | FP-2 | P1 | 异常 | 状态转换 | 半自动 |\n\n## 📊 测试点统计\n\n总测试点: 12 | P0: 5 | P1: 5 | P2: 2 | AI自动提取: 10 | 人工建议: 2\n",
    "test-cases": "## 📊 用例汇总表\n\n| 编号 | 用例标题 | 优先级 | 测试类型 | 对应测试点 |\n|------|---------|--------|---------|-----------|\n| TC-001 | 正常提交流程 | P0 | 功能 | TP-001 |\n| TC-002 | 必填项校验 | P0 | 异常 | TP-002 |\n| TC-003 | 超长输入边界 | P1 | 边界 | TP-003 |\n\n## 📋 用例详情\n\n### TC-001: 正常提交流程\n\n- **优先级**: P0\n- **测试类型**: 功能测试\n- **设计技术**: 等价类划分\n- **对应测试点**: TP-001\n- **前置条件**: 用户已登录\n- **操作步骤**:\n  1. 填写合法表单数据\n  2. 点击提交\n- **预期结果**: 提交成功并返回确认信息\n\n### TC-002: 必填项校验\n\n- **优先级**: P0\n- **测试类型**: 异常测试\n- **设计技术**: 错误推测\n- **对应测试点**: TP-002\n- **前置条件**: 用户已登录\n- **操作步骤**:\n  1. 清空必填字段\n  2. 点击提交\n- **预期结果**: 提示必填校验错误\n\n## 📈 统计信息\n\n- **总用例数**: 12 条\n- **P0**: 5 条 | **P1**: 5 条 | **P2**: 2 条\n",
    "test-review": "## 📋 评审概述\n\n对 12 条用例进行交叉评审，整体质量良好，覆盖全部 P0 测试点。\n\n## 📊 覆盖率检查\n\n- **需求覆盖率**: 100%\n- **测试点覆盖率**: 12/12\n\n## 🔄 关联性分析\n\n### AI检测的遗漏场景\n\n| 遗漏类型 | 描述 | 建议新增用例 |\n|---------|------|-------------|\n| 并发场景 | 同时提交同一数据 | TC-013(补充) |\n\n### TC-013 (补充): 并发提交冲突\n\n- **优先级**: P1\n- **测试类型**: 异常测试\n- **操作步骤**:\n  1. 两用户同时提交相同记录\n- **预期结果**: 仅一次成功，另一次提示冲突\n\n## 📊 评审总结\n\n总体质量评分: 8.5/10；通过用例: 11 | 需修改: 1 | 不通过: 0\n",
}


def _stage_meta() -> list[dict]:
    return [{"key": s["key"], "label": s["label"]} for s in STAGES]


async def resolve_execution_mode(db=None) -> dict:
    """解析当前执行档位：返回 {tier, mode, concurrency, model, provider_name}"""
    settings = get_settings()
    provider = None

    if db is not None:
        result = await db.execute(
            select(LLMProvider)
            .where(LLMProvider.status == "已启用")
            .where(LLMProvider.type.like("%Chat%"))
            .order_by(LLMProvider.updated_at.desc())
            .limit(1)
        )
        provider = result.scalars().first()

    # 判定档位：env 显式配置 > Provider.tier > 模型名启发式
    tier = settings.MODEL_TIER
    if tier not in ("free", "paid"):
        if provider and getattr(provider, "tier", None) in ("free", "paid"):
            tier = provider.tier
        else:
            model_name = (
                provider.model if provider else settings.DEFAULT_LLM_MODEL
            ) or ""
            tier = "free" if "free" in model_name.lower() else "paid"

    if tier == "free":
        concurrency = 1
    else:
        provider_limit = getattr(provider, "max_concurrency", None) or 0
        concurrency = max(
            1,
            min(
                settings.MAX_PARALLEL_SEQUENCES,
                provider_limit or settings.MAX_PARALLEL_SEQUENCES,
            ),
        )

    return {
        "tier": tier,
        "mode": "serial" if tier == "free" else "parallel",
        "concurrency": concurrency,
        "model": provider.model if provider else settings.DEFAULT_LLM_MODEL,
        "provider_name": provider.name if provider else "默认配置",
        "source": "provider" if provider else "settings",
    }


class GroupRuntime:
    """调度组内存态：任务状态 + 事件缓冲 + 订阅通知"""

    def __init__(
        self,
        group_id: int,
        name: str,
        tasks: list[dict],
        mode_info: dict,
        simulated: bool,
    ):
        self.group_id = group_id
        self.name = name
        self.tasks = tasks  # [{order, lane, name, content, status, stages, duration, error, pipeline_record_id}]
        self.mode_info = mode_info
        self.simulated = simulated
        self.events: list[tuple[str, dict]] = []
        self.done = False
        self.cancelled = False
        self.started_at = time.time()
        self.completed_at: Optional[float] = None
        self.cond = asyncio.Condition()
        self.task: Optional[asyncio.Task] = None
        # 并行通道槽位
        self._free_lanes = list(range(1, max(1, mode_info["concurrency"]) + 1))
        self._lane_lock = asyncio.Lock()

    async def push(self, event: str, data: dict):
        async with self.cond:
            self.events.append((event, data))
            self.cond.notify_all()

    async def finish(self):
        async with self.cond:
            self.done = True
            self.completed_at = time.time()
            self.cond.notify_all()

    async def acquire_lane(self) -> int:
        async with self._lane_lock:
            if self._free_lanes:
                return self._free_lanes.pop(0)
            return 1

    async def release_lane(self, lane: int):
        async with self._lane_lock:
            if lane not in self._free_lanes:
                self._free_lanes.append(lane)
                self._free_lanes.sort()

    def snapshot(self) -> dict:
        done = sum(1 for t in self.tasks if t["status"] == "completed")
        failed = sum(1 for t in self.tasks if t["status"] in ("failed", "cancelled"))
        return {
            "id": self.group_id,
            "name": self.name,
            "status": "running" if not self.done else self._final_status(),
            "mode": self.mode_info["mode"],
            "tier": self.mode_info["tier"],
            "concurrency": self.mode_info["concurrency"],
            "model": self.mode_info["model"],
            "simulated": self.simulated,
            "total_tasks": len(self.tasks),
            "done_tasks": done,
            "failed_tasks": failed,
            "tasks": self.tasks,
            "total_duration": round(time.time() - self.started_at, 1)
            if not self.done
            else self._duration(),
            "event_count": len(self.events),
        }

    def _duration(self) -> float:
        return round((self.completed_at or time.time()) - self.started_at, 1)

    def _final_status(self) -> str:
        statuses = [t["status"] for t in self.tasks]
        if self.cancelled:
            return "cancelled"
        if all(s == "completed" for s in statuses):
            return "completed"
        if all(s in ("failed", "cancelled") for s in statuses):
            return "failed"
        return "partial"


GROUPS: dict[int, GroupRuntime] = {}


def _purge_finished_groups():
    now = time.time()
    for gid in [
        g
        for g, rt in GROUPS.items()
        if rt.done and rt.completed_at and now - rt.completed_at > RUN_RETENTION_SECONDS
    ]:
        GROUPS.pop(gid, None)


async def start_group(
    name: str,
    raw_tasks: list[dict],
    simulated: bool = False,
    created_by: Optional[int] = None,
    project_id: Optional[int] = None,
    version_id: Optional[int] = None,
) -> dict:
    """创建并启动一个序列调度组，返回快照"""
    _purge_finished_groups()

    async with AsyncSessionLocal() as session:
        mode_info = await resolve_execution_mode(session)

        tasks = []
        for i, t in enumerate(raw_tasks):
            tasks.append(
                {
                    "order": i + 1,
                    "lane": None,
                    "name": t.get("requirement_name") or f"任务{i + 1}",
                    "content_preview": (t.get("requirement_content") or "")[:200],
                    "content": t.get("requirement_content") or "",
                    "project_id": t.get("project_id", project_id),
                    "version_id": t.get("version_id", version_id),
                    "status": "queued",
                    "pipeline_record_id": None,
                    "duration": 0,
                    "error": None,
                    "stages": [
                        {
                            "key": s["key"],
                            "label": s["label"],
                            "status": "waiting",
                            "duration": 0,
                        }
                        for s in _stage_meta()
                    ],
                }
            )

        group = SequenceGroup(
            name=name or f"序列调度-{time.strftime('%m%d-%H%M%S')}",
            status="running",
            mode=mode_info["mode"],
            tier=mode_info["tier"],
            concurrency=mode_info["concurrency"],
            model=mode_info["model"],
            simulated=simulated,
            total_tasks=len(tasks),
            tasks=[{k: v for k, v in t.items() if k != "content"} for t in tasks],
            created_by=created_by,
            project_id=project_id,
            version_id=version_id,
        )
        session.add(group)
        await session.commit()
        await session.refresh(group)
        group_id = group.id

    runtime = GroupRuntime(group_id, group.name, tasks, mode_info, simulated)
    GROUPS[group_id] = runtime
    runtime.task = asyncio.create_task(_coordinate(runtime, group_id))
    logger.info(
        f"🚀 序列调度组 #{group_id} 启动: {runtime.name} | "
        f"tier={mode_info['tier']} mode={mode_info['mode']} 并发={mode_info['concurrency']} "
        f"任务数={len(tasks)} simulated={simulated}"
    )
    return runtime.snapshot()


async def _coordinate(runtime: GroupRuntime, group_id: int):
    """调度协调器：信号量控制并发，任务级并行/串行"""
    concurrency = max(1, runtime.mode_info["concurrency"])
    semaphore = asyncio.Semaphore(concurrency)

    await runtime.push(
        "group_start",
        {
            "group_id": group_id,
            "mode": runtime.mode_info["mode"],
            "tier": runtime.mode_info["tier"],
            "concurrency": concurrency,
            "total_tasks": len(runtime.tasks),
            "tasks": [
                {k: v for k, v in t.items() if k != "content"} for t in runtime.tasks
            ],
        },
    )

    workers = [
        asyncio.create_task(_worker(runtime, t, semaphore)) for t in runtime.tasks
    ]
    await asyncio.gather(*workers, return_exceptions=True)

    final_status = runtime._final_status()
    snapshot = runtime.snapshot()
    await runtime.push(
        "group_complete",
        {
            "group_id": group_id,
            "status": final_status,
            "done_tasks": snapshot["done_tasks"],
            "failed_tasks": snapshot["failed_tasks"],
            "total_duration": snapshot["total_duration"],
            "tasks": snapshot["tasks"],
        },
    )
    await runtime.finish()

    # 落库
    try:
        async with AsyncSessionLocal() as session:
            group = await session.get(SequenceGroup, group_id)
            if group:
                group.status = final_status
                group.done_tasks = snapshot["done_tasks"]
                group.failed_tasks = snapshot["failed_tasks"]
                group.total_duration = snapshot["total_duration"]
                group.tasks = [
                    {k: v for k, v in t.items() if k != "content"}
                    for t in runtime.tasks
                ]
                await session.commit()
        logger.info(
            f"🏁 序列调度组 #{group_id} 完成: {final_status} "
            f"(成功{snapshot['done_tasks']}/失败{snapshot['failed_tasks']}, {snapshot['total_duration']}s)"
        )
    except Exception as e:
        logger.error(f"❌ 序列调度组 #{group_id} 落库失败: {e}")


async def _worker(runtime: GroupRuntime, task: dict, semaphore: asyncio.Semaphore):
    """单任务 worker：等待槽位 → 分配 Lane → 执行序列 → 释放 Lane"""
    if runtime.cancelled:
        task["status"] = "cancelled"
        await runtime.push(
            "task_cancelled", {"order": task["order"], "name": task["name"]}
        )
        return

    task["status"] = "waiting_slot"
    await runtime.push("task_queued", {"order": task["order"], "name": task["name"]})

    async with semaphore:
        if runtime.cancelled:
            task["status"] = "cancelled"
            await runtime.push(
                "task_cancelled", {"order": task["order"], "name": task["name"]}
            )
            return

        lane = await runtime.acquire_lane()
        task["lane"] = lane
        task["status"] = "running"
        task_start = time.time()
        logger.info(
            f"  ▶ 任务 #{task['order']}「{task['name']}」进入 Lane-{lane} "
            f"({runtime.mode_info['mode']})"
        )
        await runtime.push(
            "task_start",
            {
                "order": task["order"],
                "lane": lane,
                "name": task["name"],
                "mode": runtime.mode_info["mode"],
                "concurrency": runtime.mode_info["concurrency"],
            },
        )

        try:
            if runtime.simulated:
                await _run_simulated(runtime, task)
            else:
                await _run_real(runtime, task)
            if task["status"] == "running":
                task["status"] = (
                    "completed"
                    if not any(s["status"] == "failed" for s in task["stages"])
                    else "failed"
                )
        except Exception as e:
            task["status"] = "failed"
            task["error"] = str(e)[:300]
            logger.error(f"  ❌ 任务 #{task['order']} 异常: {e}")
            await runtime.push(
                "task_failed",
                {"order": task["order"], "lane": lane, "error": task["error"]},
            )
        finally:
            task["duration"] = round(time.time() - task_start, 1)
            await runtime.release_lane(lane)

        if task["status"] == "completed":
            await runtime.push(
                "task_complete",
                {
                    "order": task["order"],
                    "lane": lane,
                    "name": task["name"],
                    "duration": task["duration"],
                    "pipeline_record_id": task.get("pipeline_record_id"),
                },
            )
        elif task["status"] == "failed":
            await runtime.push(
                "task_failed",
                {
                    "order": task["order"],
                    "lane": lane,
                    "name": task["name"],
                    "error": task.get("error") or "存在失败阶段",
                    "duration": task["duration"],
                },
            )


async def _run_real(runtime: GroupRuntime, task: dict):
    """真实执行：调用 PipelineService，把 Pipeline SSE 事件翻译为组事件"""

    def _on_record_created(record_id: int):
        task["pipeline_record_id"] = record_id

    async with AsyncSessionLocal() as session:
        service = PipelineService(db=session)
        stream = service.run_pipeline(
            requirement_content=task["content"],
            requirement_name=task["name"],
            project_id=task.get("project_id"),
            version_id=task.get("version_id"),
            db=session,
            sequence_group_id=runtime.group_id,
            sequence_lane=task["lane"],
            on_record_created=_on_record_created,
        )
        async for raw in stream:
            event, data = _parse_sse(raw)
            stage_key = data.get("stage")
            s_item = next((s for s in task["stages"] if s["key"] == stage_key), None)
            if event == "stage_start" and s_item:
                s_item["status"] = "running"
                await runtime.push(
                    "task_stage",
                    {
                        "order": task["order"],
                        "lane": task["lane"],
                        "stage": stage_key,
                        "label": s_item["label"],
                        "status": "running",
                    },
                )
            elif event == "stage_complete" and s_item and not data.get("skipped"):
                s_item["status"] = "completed"
                s_item["duration"] = data.get("duration", 0)
                await runtime.push(
                    "task_stage",
                    {
                        "order": task["order"],
                        "lane": task["lane"],
                        "stage": stage_key,
                        "label": s_item["label"],
                        "status": "completed",
                        "duration": data.get("duration", 0),
                    },
                )
            elif event == "stage_error" and s_item:
                s_item["status"] = "failed"
                await runtime.push(
                    "task_stage",
                    {
                        "order": task["order"],
                        "lane": task["lane"],
                        "stage": stage_key,
                        "label": s_item["label"],
                        "status": "failed",
                        "error": str(data.get("error", ""))[:200],
                    },
                )


async def _run_simulated(runtime: GroupRuntime, task: dict):
    """模拟执行：可控延时 + 演示输出，用于模式演示与回归验证"""
    # 付费并行模式下单阶段短延时；免费串行走完整耗时（模拟真实节奏但压缩）
    per_stage = 1.5 if runtime.mode_info["mode"] == "parallel" else 2.2
    scope = task["name"]
    for s_item in task["stages"]:
        if runtime.cancelled:
            task["status"] = "cancelled"
            return
        s_item["status"] = "running"
        await runtime.push(
            "task_stage",
            {
                "order": task["order"],
                "lane": task["lane"],
                "stage": s_item["key"],
                "label": s_item["label"],
                "status": "running",
                "simulated": True,
            },
        )
        t0 = time.time()
        await asyncio.sleep(per_stage)
        s_item["status"] = "completed"
        s_item["duration"] = int((time.time() - t0) * 1000)
        await runtime.push(
            "task_stage",
            {
                "order": task["order"],
                "lane": task["lane"],
                "stage": s_item["key"],
                "label": s_item["label"],
                "status": "completed",
                "duration": s_item["duration"],
                "simulated": True,
            },
        )


def _parse_sse(raw: str) -> tuple[Optional[str], dict]:
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


async def stream_group(runtime: GroupRuntime, since: int = 0):
    """SSE 订阅：重放 + 实时"""
    idx = max(0, since)
    while True:
        async with runtime.cond:
            while idx >= len(runtime.events) and not runtime.done:
                try:
                    await asyncio.wait_for(runtime.cond.wait(), timeout=20.0)
                except asyncio.TimeoutError:
                    break
            batch = runtime.events[idx:]
            idx = len(runtime.events)
            done = runtime.done
        if not batch:
            if done:
                break
            yield ": keep-alive\n\n"
            continue
        for event, data in batch:
            yield f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        if done:
            break
