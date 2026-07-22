"""Midscene.js 引擎 — 基于 @midscene/web 的视觉 AI 测试"""

import json
import time
from typing import Any, Callable, Optional

from agents.web_explorer import WebExplorerAgent
from agents.execution_agent import ExecutionAgent
from .base import (
    BaseEngine,
    EngineConfig,
    ExploreResult,
    TestCaseResult,
    StepResult,
)


class MidsceneEngine(BaseEngine):
    """Midscene.js 引擎

    封装 WebExplorerAgent 和 ExecutionAgent，提供统一引擎接口。
    通过 Python 子进程调用 Node.js 运行 midscene.js 脚本。
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        super().__init__(config)
        cfg = self.config
        self._explorer = WebExplorerAgent(
            model_name=cfg.model_name,
            api_key=cfg.api_key,
            base_url=cfg.base_url,
            model_family=cfg.model_family,
        )
        self._executor = ExecutionAgent(
            model_name=cfg.model_name,
            api_key=cfg.api_key,
            base_url=cfg.base_url,
            model_family=cfg.model_family,
        )

    async def explore(
        self,
        url: str,
        callback: Optional[Callable] = None,
    ) -> ExploreResult:
        """AI 探索目标网站"""
        self.logger.info(f"[MidsceneEngine] 探索: {url}")

        # 重用 WebExplorerAgent
        raw = await self._explorer.explore(url, callback)

        pages = raw.get("pages", [])
        structure = raw.get("structure") or {}
        first_page = pages[0] if pages else {}

        return ExploreResult(
            url=url,
            title=structure.get("title", first_page.get("title", "")),
            description=structure.get("description", ""),
            pages=pages,
            structure=structure,
            interactive_elements=structure.get("interactive_elements", []),
            forms=structure.get("forms", []),
            navigation_links=structure.get("navigation_links", []),
            sections=structure.get("sections", []),
        )

    async def execute_test_case(
        self,
        case: dict,
        callback: Optional[Callable] = None,
    ) -> TestCaseResult:
        """执行单条测试用例"""
        case_id = case.get("id", "unknown")
        case_title = case.get("title", "")

        self.logger.info(f"[MidsceneEngine] 执行用例: {case_title}")

        results = await self._executor.run(
            project_id=case.get("project_id", 0),
            test_cases=[case],
            callback=callback,
        )

        raw = results[0] if results else {}
        return TestCaseResult(
            case_id=case_id,
            case_title=case_title,
            status=raw.get("status", "error"),
            duration_ms=raw.get("duration_ms", 0),
            error=raw.get("error", ""),
            screenshot=raw.get("screenshot", ""),
            steps=[
                StepResult(
                    step=s.get("step", i),
                    action=s.get("action", ""),
                    target=s.get("target", ""),
                    status=s.get("status", "skipped"),
                    error=s.get("error", ""),
                )
                for i, s in enumerate(raw.get("steps", []))
            ],
        )

    async def execute_test_suite(
        self,
        cases: list[dict],
        callback: Optional[Callable] = None,
    ) -> list[TestCaseResult]:
        """批量执行测试用例（代理直接批量处理）"""
        self.logger.info(f"[MidsceneEngine] 批量执行 {len(cases)} 条用例")

        raw_results = await self._executor.run(
            project_id=cases[0].get("project_id", 0) if cases else 0,
            test_cases=cases,
            callback=callback,
        )

        results: list[TestCaseResult] = []
        for raw in raw_results:
            results.append(TestCaseResult(
                case_id=raw.get("case_id", "unknown"),
                case_title=raw.get("case_title", ""),
                status=raw.get("status", "error"),
                duration_ms=raw.get("duration_ms", 0),
                error=raw.get("error", ""),
                screenshot=raw.get("screenshot", ""),
            ))
        return results

    async def generate_test_cases(
        self,
        spec: str,
        context: Optional[dict] = None,
        callback: Optional[Callable] = None,
    ) -> list[dict]:
        """AI 根据需求规格生成测试用例（通过 LLM）"""
        self.logger.info(f"[MidsceneEngine] 生成测试用例...")

        system_prompt = (
            "你是一个 Web 测试专家。根据用户提供的需求规格，生成详细的 Web 测试用例。"
            "每个用例包含: title, steps (action/target/value), page_url, priority。"
            "返回 JSON 数组，不要包裹 markdown 代码块。"
        )

        context_str = ""
        if context:
            context_str = f"\n额外上下文:\n{json.dumps(context, ensure_ascii=False, indent=2)}"

        prompt = (
            f"需求规格:\n{spec}\n"
            f"{context_str}\n"
            f"请生成测试用例的 JSON 数组。"
        )

        content = await self._executor.call_llm(prompt, system_prompt)

        try:
            # 清理可能的 markdown 代码块包裹
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1]
                cleaned = cleaned.rsplit("```", 1)[0]
            cases = json.loads(cleaned)
            if isinstance(cases, list):
                return cases
            return []
        except json.JSONDecodeError as e:
            self.logger.error(f"LLM 返回非 JSON: {e}")
            return []

    async def health_check(self) -> dict:
        """健康检查 — 验证 midscene.js 是否可用"""
        try:
            import subprocess
            result = subprocess.run(
                ["node", "--eval", "require('@midscene/web')"],
                capture_output=True, text=True, timeout=10,
            )
            available = result.returncode == 0
            return {
                "engine": "midscene",
                "available": available,
                "model": self.config.model_name,
                "error": result.stderr[:200] if not available else "",
            }
        except Exception as e:
            return {
                "engine": "midscene",
                "available": False,
                "error": str(e),
            }
