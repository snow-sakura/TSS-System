"""引擎抽象基类与通用类型定义"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Optional

from core.logging_config import get_logger


class EngineType(str, Enum):
    """支持的引擎类型"""
    MIDSCENE = "midscene"
    PLAYWRIGHT_MCP = "playwright_mcp"
    BROWSER_USE = "browser_use"  # 预留
    UI_TARS = "ui_tars"          # 预留
    MOCK = "mock"                # 模拟引擎（测试用）


@dataclass
class EngineConfig:
    """引擎通用配置"""
    model_name: str = "qwen3.7-plus"
    api_key: str = ""
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    model_family: str = "qwen3"
    headless: bool = True
    viewport_width: int = 1280
    viewport_height: int = 720
    timeout_ms: int = 30000
    extra: dict = field(default_factory=dict)


@dataclass
class StepResult:
    """单步执行结果"""
    step: int
    action: str               # tap / input / assert / query
    target: str
    status: str               # passed / failed / skipped
    error: str = ""
    duration_ms: int = 0
    screenshot: str = ""
    data: dict = field(default_factory=dict)


@dataclass
class TestCaseResult:
    """测试用例执行结果"""
    case_id: Any
    case_title: str = ""
    status: str = "pending"   # passed / failed / error / skipped
    duration_ms: int = 0
    error: str = ""
    screenshot: str = ""
    steps: list[StepResult] = field(default_factory=list)


@dataclass
class ExploreResult:
    """网页探索结果"""
    url: str
    title: str = ""
    description: str = ""
    pages: list[dict] = field(default_factory=list)
    structure: Optional[dict] = None
    interactive_elements: list[dict] = field(default_factory=list)
    forms: list[dict] = field(default_factory=list)
    navigation_links: list[str] = field(default_factory=list)
    sections: list[str] = field(default_factory=list)


class BaseEngine(ABC):
    """引擎基类 — 所有 AI 测试引擎的统一接口"""

    def __init__(self, config: Optional[EngineConfig] = None):
        self.config = config or EngineConfig()
        self.logger = get_logger(self.__class__.__name__)

    @abstractmethod
    async def explore(
        self,
        url: str,
        callback: Optional[Callable] = None,
    ) -> ExploreResult:
        """AI 探索目标网站，返回页面结构和元素信息"""
        ...

    @abstractmethod
    async def execute_test_case(
        self,
        case: dict,
        callback: Optional[Callable] = None,
    ) -> TestCaseResult:
        """执行单条测试用例"""
        ...

    async def execute_test_suite(
        self,
        cases: list[dict],
        callback: Optional[Callable] = None,
    ) -> list[TestCaseResult]:
        """执行测试套件（默认逐个执行，子类可覆盖做批量优化）"""
        results: list[TestCaseResult] = []
        for idx, case in enumerate(cases):
            if callback:
                await callback({
                    "type": "case_start",
                    "case_id": case.get("id", idx),
                    "index": idx + 1,
                    "total": len(cases),
                })
            result = await self.execute_test_case(case, callback)
            results.append(result)
            if callback:
                await callback({
                    "type": "case_complete",
                    "case_id": result.case_id,
                    "status": result.status,
                    "duration_ms": result.duration_ms,
                    "error": result.error,
                })
        return results

    @abstractmethod
    async def generate_test_cases(
        self,
        spec: str,
        context: Optional[dict] = None,
        callback: Optional[Callable] = None,
    ) -> list[dict]:
        """AI 根据需求规格生成测试用例"""
        ...

    @abstractmethod
    async def health_check(self) -> dict:
        """引擎健康检查"""
        ...

    async def cleanup(self):
        """释放资源（子类可覆盖）"""
        pass
