"""测试执行引擎 - 管理测试执行的生命周期，支持SSE实时推送进度"""
import asyncio
import json
import time
from datetime import datetime
from typing import AsyncGenerator, Optional

from core.logging_config import get_logger
from engines import BaseEngine, EngineConfig, get_engine, EngineType

logger = get_logger("execution_engine")

# 全局执行状态存储 (生产环境应使用Redis)
_execution_states: dict[int, dict] = {}

# 默认引擎类型（可通过API动态切换）
_default_engine_type: str = "mock"


def set_default_engine(engine_type: str):
    """设置默认引擎类型"""
    global _default_engine_type
    _default_engine_type = engine_type
    logger.info(f"默认引擎切换为: {engine_type}")


def get_default_engine() -> str:
    """获取当前默认引擎类型"""
    return _default_engine_type


def get_execution_state(execution_id: int) -> Optional[dict]:
    return _execution_states.get(execution_id)


def set_execution_state(execution_id: int, state: dict):
    _execution_states[execution_id] = state


def _create_engine() -> BaseEngine:
    """创建当前默认引擎实例"""
    engine_type = _default_engine_type
    # 从配置读取引擎参数
    from config import get_settings
    settings = get_settings()
    config = EngineConfig(
        model_name=settings.MIDSCENE_MODEL_NAME,
        api_key=settings.MIDSCENE_MODEL_API_KEY,
        base_url=settings.MIDSCENE_MODEL_BASE_URL,
        model_family=settings.MIDSCENE_MODEL_FAMILY,
    )
    return get_engine(engine_type, config=config)


async def start_execution(
    execution_id: int,
    test_case_ids: list[int],
    environment: str = "测试环境",
    total_cases: int = 0,
) -> dict:
    """启动测试执行"""
    state = {
        "id": execution_id,
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "total": total_cases or len(test_case_ids),
        "passed": 0,
        "failed": 0,
        "skipped": 0,
        "current_case": 0,
        "test_case_ids": test_case_ids,
        "results": [],
        "logs": [],
        "engine": _default_engine_type,
    }
    set_execution_state(execution_id, state)
    logger.info(f"启动执行 #{execution_id}, 用例数: {len(test_case_ids)}, 环境: {environment}, 引擎: {_default_engine_type}")
    return state


async def stop_execution(execution_id: int) -> dict:
    """停止执行"""
    state = get_execution_state(execution_id)
    if state:
        state["status"] = "stopped"
        state["completed_at"] = datetime.now().isoformat()
        set_execution_state(execution_id, state)
        logger.info(f"停止执行 #{execution_id}")
    return state or {"status": "not_found"}


async def execute_test_suite(
    execution_id: int,
    test_case_ids: list[int],
    test_case_details: Optional[list[dict]] = None,
) -> AsyncGenerator[dict, None]:
    """执行测试套件，使用真实引擎逐步推送进度事件

    Args:
        execution_id: 执行记录ID
        test_case_ids: 测试用例ID列表
        test_case_details: 测试用例详情列表（含steps等），如不提供则尝试从DB加载
    """
    state = get_execution_state(execution_id)
    if not state:
        yield {"type": "error", "message": f"执行 {execution_id} 不存在"}
        return

    total = len(test_case_ids)
    state["total"] = total
    state["started_at"] = datetime.now().isoformat()

    yield {
        "type": "started",
        "execution_id": execution_id,
        "total": total,
        "engine": _default_engine_type,
        "timestamp": datetime.now().isoformat(),
    }

    # 构建引擎需要的用例格式
    cases_for_engine: list[dict] = []
    if test_case_details:
        cases_for_engine = test_case_details
    else:
        # 从DB加载用例（如果有）
        try:
            from sqlalchemy import select
            from database import AsyncSessionLocal
            from models.test_lifecycle import TestCase

            async with AsyncSessionLocal() as db:
                for cid in test_case_ids:
                    result = await db.execute(select(TestCase).where(TestCase.id == cid))
                    tc = result.scalar_one_or_none()
                    if tc:
                        cases_for_engine.append({
                            "id": tc.id,
                            "title": tc.name or tc.title,
                            "page_url": tc.page_url or "",
                            "steps": tc.steps or [],
                        })
        except Exception as e:
            logger.warning(f"从DB加载用例失败: {e}")
            # 降级：用ID构造简单用例
            cases_for_engine = [
                {"id": cid, "title": f"用例 #{cid}", "steps": []}
                for cid in test_case_ids
            ]

    if not cases_for_engine:
        yield {"type": "error", "message": "没有可执行的用例"}
        return

    # 使用引擎执行
    try:
        engine = _create_engine()
        logger.info(f"使用引擎 {_default_engine_type} 执行 {len(cases_for_engine)} 条用例")

        results = await engine.execute_test_suite(cases_for_engine, callback=None)

        for idx, result in enumerate(results):
            case_id = result.case_id
            state["current_case"] = idx + 1

            if result.status == "passed":
                state["passed"] += 1
            elif result.status == "failed":
                state["failed"] += 1
            else:
                state["skipped"] += 1

            state["results"].append({
                "case_id": case_id,
                "result": result.status,
                "duration_ms": result.duration_ms,
                "error": result.error,
            })

            log_msg = (
                f"[{datetime.now().strftime('%H:%M:%S')}] "
                f"用例#{case_id} {result.status} ({result.duration_ms}ms)"
            )
            state["logs"].append(log_msg)
            set_execution_state(execution_id, state)

            yield {
                "type": "case_complete",
                "case_id": case_id,
                "index": idx + 1,
                "total": total,
                "result": result.status,
                "duration_ms": result.duration_ms,
                "error": result.error,
                "passed": state["passed"],
                "failed": state["failed"],
                "skipped": state["skipped"],
                "timestamp": datetime.now().isoformat(),
            }

        # 引擎资源清理
        await engine.cleanup()

    except Exception as e:
        logger.error(f"引擎执行失败: {e}")
        state["status"] = "failed"
        state["error"] = str(e)
        set_execution_state(execution_id, state)
        yield {
            "type": "error",
            "message": f"引擎执行失败: {e}",
            "timestamp": datetime.now().isoformat(),
        }
        return

    state["status"] = "completed"
    state["completed_at"] = datetime.now().isoformat()
    state["pass_rate"] = round(state["passed"] / total * 100, 1) if total > 0 else 0
    state["duration_ms"] = sum(r.get("duration_ms", 0) for r in state["results"])
    set_execution_state(execution_id, state)

    yield {
        "type": "completed",
        "execution_id": execution_id,
        "passed": state["passed"],
        "failed": state["failed"],
        "skipped": state["skipped"],
        "pass_rate": state["pass_rate"],
        "duration_ms": state["duration_ms"],
        "total": total,
        "engine": _default_engine_type,
        "timestamp": datetime.now().isoformat(),
    }

    logger.info(
        f"执行 #{execution_id} 完成: 通过={state['passed']}, "
        f"失败={state['failed']}, 跳过={state['skipped']}, "
        f"通过率={state['pass_rate']}%, 引擎={_default_engine_type}"
    )


async def get_execution_progress(execution_id: int) -> dict:
    """获取执行进度"""
    state = get_execution_state(execution_id)
    if not state:
        return {"status": "not_found"}
    return {
        "execution_id": execution_id,
        "status": state["status"],
        "total": state["total"],
        "passed": state["passed"],
        "failed": state["failed"],
        "skipped": state["skipped"],
        "current_case": state["current_case"],
        "pass_rate": round(state["passed"] / state["total"] * 100, 1) if state["total"] > 0 else 0,
        "results": state["results"],
        "logs": state["logs"],
        "engine": state.get("engine", "unknown"),
    }


async def stream_execution_events(
    execution_id: int,
    test_case_ids: list[int],
    test_case_details: Optional[list[dict]] = None,
    environment: str = "测试环境",
) -> AsyncGenerator[str, None]:
    """SSE格式推送执行事件"""
    state = await start_execution(execution_id, test_case_ids, environment)
    async for event in execute_test_suite(execution_id, test_case_ids, test_case_details):
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
