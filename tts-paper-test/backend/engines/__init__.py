"""
TSS Engine Layer — AI 测试引擎统一抽象层

提供四种引擎的统一接口：
- MidsceneEngine: 基于 @midscene/web 的视觉 AI 测试
- PlaywrightMCPEngine: 基于 Playwright MCP 协议的测试
- MockEngine: 模拟引擎（开发测试用）
- BrowserUseEngine: (预留) 基于 Browser Use 的测试
- UITarsEngine: (预留) 基于 UI-TARS 的测试

用法:
    from engines import get_engine
    engine = get_engine("midscene")
    result = await engine.execute_test_case(case)
"""

from .registry import EngineRegistry
from .base import (
    BaseEngine,
    EngineConfig,
    EngineType,
    ExploreResult,
    TestCaseResult,
    StepResult,
)

# 注册内置引擎
from .mock_engine import MockEngine
from .midscene_engine import MidsceneEngine
from .playwright_mcp_engine import PlaywrightMCPEngine

EngineRegistry.register(EngineType.MOCK, MockEngine)
EngineRegistry.register(EngineType.MIDSCENE, MidsceneEngine)
EngineRegistry.register(EngineType.PLAYWRIGHT_MCP, PlaywrightMCPEngine)


# 便捷函数
def get_engine(engine_type: str | EngineType, **kwargs) -> BaseEngine:
    """获取指定类型的引擎实例"""
    return EngineRegistry.create(engine_type, **kwargs)


def register_engine(engine_type: str | EngineType, engine_class: type):
    """注册自定义引擎"""
    EngineRegistry.register(engine_type, engine_class)


__all__ = [
    "BaseEngine",
    "EngineConfig",
    "EngineType",
    "EngineRegistry",
    "ExploreResult",
    "TestCaseResult",
    "StepResult",
    "get_engine",
    "register_engine",
]
