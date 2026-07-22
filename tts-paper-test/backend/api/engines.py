"""引擎管理 API — 查询引擎列表、切换引擎、健康检查"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from engines import EngineRegistry, get_engine
from services.execution_engine import set_default_engine, get_default_engine

router = APIRouter(prefix="/api/v1/engines", tags=["引擎管理"])


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
async def list_engines() -> list[EngineInfo]:
    """列出所有已注册引擎及其健康状态"""
    engines = []
    for engine_type in EngineRegistry.list_types():
        # 创建轻量实例做健康检查
        try:
            engine = get_engine(engine_type)
            health = await engine.health_check()
            await engine.cleanup()
        except Exception:
            health = {"available": False, "error": "实例化失败"}

        engines.append(EngineInfo(
            type=engine_type,
            available=health.get("available", False),
            is_default=(engine_type == get_default_engine()),
            error=health.get("error", ""),
        ))

    return engines


@router.post("/switch", summary="切换默认引擎")
async def switch_engine(req: SwitchEngineRequest) -> dict:
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
async def current_engine() -> dict:
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
async def engine_health(engine_type: str) -> dict:
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
