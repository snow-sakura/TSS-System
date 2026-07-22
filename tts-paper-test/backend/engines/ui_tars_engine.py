"""
UI-TARS Engine — 多模态 GUI Agent 引擎

UI-TARS Desktop 是字节跳动开源的多模态 GUI Agent（38k+ Stars），
基于 UI-TARS VLM 模型驱动，支持本地桌面和浏览器操作。
支持 Hugging Face 和火山引擎等多种 VLM 后端。

参考: https://github.com/bytedance/UI-TARS-desktop

注意: 当前为预留桩代码，实际集成需安装 UI-TARS Desktop。
"""

from .base import BaseEngine, EngineConfig, ExploreResult, TestCaseResult

from core.logging_config import get_logger


class UITarsEngine(BaseEngine):
    """UI-TARS 引擎 — 多模态 GUI Agent 驱动"""

    def __init__(self, config: EngineConfig | None = None):
        super().__init__(config)
        self.logger = get_logger("UITarsEngine")

    async def health_check(self) -> dict:
        """检查 UI-TARS 环境是否就绪"""
        return {
            "available": False,
            "error": (
                "UI-TARS 引擎正在集成中。"
                "请访问 https://github.com/bytedance/UI-TARS-desktop 了解详情。"
            ),
        }

    async def explore(self, url: str, **kwargs) -> ExploreResult:
        raise NotImplementedError(
            "UI-TARS 引擎正在集成中。请切换到 Midscene.js 或 Playwright MCP 引擎。"
        )

    async def execute_test_case(self, case: dict, **kwargs) -> TestCaseResult:
        raise NotImplementedError(
            "UI-TARS 引擎正在集成中。请切换到 Midscene.js 或 Playwright MCP 引擎。"
        )

    async def cleanup(self):
        """清理资源"""
        pass
