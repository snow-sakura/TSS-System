"""引擎管理 API — 查询引擎列表、切换引擎、健康检查"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from engines import EngineRegistry, get_engine
from services.execution_engine import set_default_engine, get_default_engine
from api.deps import get_current_user_dep
from models.user import User

router = APIRouter(prefix="/api/v1/engines", tags=["引擎管理"])

# 单引擎健康检查超时（秒）：组件服务不可达时快速降级，避免拖慢列表
HEALTH_CHECK_TIMEOUT_S = 2.0


class EngineInfo(BaseModel):
    """引擎信息"""

    type: str
    available: bool
    is_default: bool = False
    error: str = ""


class SwitchEngineRequest(BaseModel):
    """切换引擎请求"""

    engine_type: str


@router.get("", summary="列出所有可用引擎")
async def list_engines(user: User = Depends(get_current_user_dep)) -> list[EngineInfo]:
    """列出所有已注册引擎及其健康状态（并行检查，单引擎超时隔离）"""
    engine_types = EngineRegistry.list_types()
    default_engine = get_default_engine()

    async def check_one(engine_type: str) -> EngineInfo:
        try:
            engine = get_engine(engine_type)
            health = await asyncio.wait_for(
                engine.health_check(), timeout=HEALTH_CHECK_TIMEOUT_S
            )
            await engine.cleanup()
            available = health.get("available", False)
            error = health.get("error", "")
        except asyncio.TimeoutError:
            available = False
            error = "健康检查超时"
        except Exception:
            available = False
            error = "实例化失败"
        return EngineInfo(
            type=engine_type,
            available=available,
            is_default=(engine_type == default_engine),
            error=error,
        )

    return await asyncio.gather(*(check_one(t) for t in engine_types))


@router.post("/switch", summary="切换默认引擎")
async def switch_engine(
    req: SwitchEngineRequest, user: User = Depends(get_current_user_dep)
) -> dict:
    """切换当前默认引擎"""
    available_types = EngineRegistry.list_types()
    if req.engine_type not in available_types:
        raise HTTPException(
            status_code=400,
            detail=f"未知引擎类型: '{req.engine_type}'. 可用: {available_types}",
        )

    set_default_engine(req.engine_type)
    return {
        "ok": True,
        "engine": req.engine_type,
        "message": f"默认引擎已切换为 '{req.engine_type}'",
    }


@router.get("/current", summary="获取当前引擎")
async def current_engine(user: User = Depends(get_current_user_dep)) -> dict:
    """获取当前默认引擎信息"""
    engine_type = get_default_engine()
    try:
        engine = get_engine(engine_type)
        health = await engine.health_check()
        await engine.cleanup()
    except Exception as e:
        health = {"available": False, "error": str(e)}

    return {
        "engine": engine_type,
        "health": health,
    }


@router.post("/{engine_type}/health", summary="引擎健康检查")
async def engine_health(
    engine_type: str, user: User = Depends(get_current_user_dep)
) -> dict:
    """对指定引擎执行健康检查"""
    available_types = EngineRegistry.list_types()
    if engine_type not in available_types:
        raise HTTPException(
            status_code=400,
            detail=f"未知引擎类型: '{engine_type}'. 可用: {available_types}",
        )

    try:
        engine = get_engine(engine_type)
        health = await engine.health_check()
        await engine.cleanup()
        return health
    except Exception as e:
        return {"engine": engine_type, "available": False, "error": str(e)}
