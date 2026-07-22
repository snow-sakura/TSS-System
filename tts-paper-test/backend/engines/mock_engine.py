"""模拟引擎 — 用于开发和测试"""

import asyncio
import random
from datetime import datetime
from typing import Any, Callable, Optional

from .base import (
    BaseEngine,
    EngineConfig,
    ExploreResult,
    TestCaseResult,
    StepResult,
)


class MockEngine(BaseEngine):
    """模拟引擎 — 随机通过/失败，用于开发测试"""

    def __init__(self, config: Optional[EngineConfig] = None):
        super().__init__(config)
        self.pass_rate: float = 0.85  # 85% 通过率

    async def explore(
        self,
        url: str,
        callback: Optional[Callable] = None,
    ) -> ExploreResult:
        self.logger.info(f"[MockEngine] 模拟探索: {url}")
        await asyncio.sleep(1.0)

        if callback:
            await callback({"type": "status", "message": "模拟探索完成"})

        return ExploreResult(
            url=url,
            title=f"模拟页面 - {url}",
            description="这是模拟引擎生成的页面描述",
            pages=[{
                "url": url,
                "title": f"模拟页面 - {url}",
                "status": "completed",
                "elements_count": 5,
            }],
            interactive_elements=[
                {"text": "登录按钮", "type": "button"},
                {"text": "用户名输入框", "type": "input"},
                {"text": "密码输入框", "type": "input"},
                {"text": "提交按钮", "type": "button"},
            ],
            navigation_links=["/home", "/about", "/contact"],
        )

    async def execute_test_case(
        self,
        case: dict,
        callback: Optional[Callable] = None,
    ) -> TestCaseResult:
        case_id = case.get("id", "unknown")
        case_title = case.get("title", "")
        steps_data = case.get("steps", [])

        self.logger.info(f"[MockEngine] 模拟执行: {case_title}")

        step_results = []
        all_passed = True

        for i, step in enumerate(steps_data):
            await asyncio.sleep(0.3 + random.random() * 0.5)
            passed = random.random() < self.pass_rate
            if not passed:
                all_passed = False

            sr = StepResult(
                step=i + 1,
                action=step.get("action", ""),
                target=step.get("target", ""),
                status="passed" if passed else "failed",
                error="" if passed else "模拟执行失败",
                duration_ms=int((0.3 + random.random() * 0.5) * 1000),
            )
            step_results.append(sr)

            if callback:
                await callback({
                    "type": "step",
                    "step": i + 1,
                    "action": step.get("action", ""),
                    "target": step.get("target", ""),
                    "status": sr.status,
                    "error": sr.error,
                })

        return TestCaseResult(
            case_id=case_id,
            case_title=case_title,
            status="passed" if all_passed else "failed",
            duration_ms=sum(s.duration_ms for s in step_results),
            error="" if all_passed else "部分步骤失败",
            steps=step_results,
        )

    async def generate_test_cases(
        self,
        spec: str,
        context: Optional[dict] = None,
        callback: Optional[Callable] = None,
    ) -> list[dict]:
        """模拟生成测试用例"""
        self.logger.info("[MockEngine] 模拟生成测试用例")
        await asyncio.sleep(0.5)

        return [
            {
                "id": 1,
                "title": f"模拟用例 1 - {spec[:20]}",
                "page_url": "https://example.com/login",
                "priority": "high",
                "steps": [
                    {"action": "navigate", "target": "https://example.com/login"},
                    {"action": "click", "target": "用户名输入框"},
                    {"action": "type", "target": "用户名输入框", "value": "test_user"},
                ],
            },
            {
                "id": 2,
                "title": f"模拟用例 2 - {spec[:20]}",
                "page_url": "https://example.com/login",
                "priority": "high",
                "steps": [
                    {"action": "navigate", "target": "https://example.com/login"},
                    {"action": "click", "target": "登录按钮"},
                    {"action": "assert", "target": "欢迎回来"},
                ],
            },
        ]

    async def health_check(self) -> dict:
        return {
            "engine": "mock",
            "available": True,
            "pass_rate": self.pass_rate,
        }
