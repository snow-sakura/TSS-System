"""Playwright MCP 引擎 — 通过 MCP 协议控制浏览器执行测试

连接 Playwright MCP Server (@playwright/mcp)，通过标准 MCP 工具调用
执行浏览器操作：导航、点击、输入、断言等。

MCP 工具映射:
  - browser_navigate(url)    → 页面导航
  - browser_click(selector)  → 元素点击
  - browser_type(selector, text) → 输入文本
  - browser_snapshot()       → 获取页面可访问性快照
  - browser_screenshot()     → 截图
"""

import json
import time
from typing import Any, Callable, Optional

from .base import (
    BaseEngine,
    EngineConfig,
    ExploreResult,
    TestCaseResult,
    StepResult,
)


class PlaywrightMCPEngine(BaseEngine):
    """Playwright MCP 引擎

    连接运行中的 Playwright MCP Server，通过 MCP 协议执行浏览器自动化。
    支持 stdio 和 HTTP 两种传输方式。
    """

    def __init__(
        self,
        config: Optional[EngineConfig] = None,
        transport: str = "stdio",
        command: str = "",
        url: str = "",
    ):
        super().__init__(config)
        self.transport = transport
        self.command = command or "npx @playwright/mcp"
        self.url = url
        self._client = None
        self._session = None

    # ── 连接管理 ──

    async def _ensure_connected(self):
        """确保 MCP 客户端已连接"""
        if self._client is not None:
            return

        if self.transport == "stdio":
            await self._connect_stdio()
        elif self.transport == "http" or self.transport == "sse":
            await self._connect_http()
        else:
            raise ValueError(f"不支持的传输方式: {self.transport}")

    async def _connect_stdio(self):
        """通过 stdio 连接 Playwright MCP Server"""
        import subprocess
        from mcp import StdioServerParameters
        from mcp.client.stdio import stdio_client

        self.logger.info(f"启动 Playwright MCP Server: {self.command}")

        server_params = StdioServerParameters(
            command=self.command.split()[0],
            args=self.command.split()[1:],
        )

        async with stdio_client(server_params) as (read, write):
            from mcp import ClientSession
            async with ClientSession(read, write) as session:
                await session.initialize()
                self._client = session

    async def _connect_http(self):
        """通过 HTTP/SSE 连接 Playwright MCP Server"""
        from mcp.client.sse import sse_client

        self.logger.info(f"连接 Playwright MCP Server: {self.url}")

        async with sse_client(self.url) as (read, write):
            from mcp import ClientSession
            async with ClientSession(read, write) as session:
                await session.initialize()
                self._client = session

    async def _call_tool(self, tool_name: str, arguments: dict = None) -> dict:
        """调用 MCP 工具"""
        await self._ensure_connected()
        result = await self._client.call_tool(tool_name, arguments or {})
        return result

    # ── 引擎接口实现 ──

    async def explore(
        self,
        url: str,
        callback: Optional[Callable] = None,
    ) -> ExploreResult:
        """探索目标网站"""
        self.logger.info(f"[PlaywrightMCP] 探索: {url}")

        await self._ensure_connected()

        if callback:
            await callback({"type": "status", "message": "正在导航到目标页面..."})

        # 导航
        await self._call_tool("browser_navigate", {"url": url})

        if callback:
            await callback({"type": "status", "message": "正在获取页面快照..."})

        # 获取页面快照
        snapshot = await self._call_tool("browser_snapshot", {})

        # 提取页面信息
        snapshot_text = str(snapshot.get("content", snapshot))

        return ExploreResult(
            url=url,
            title=self._extract_title(snapshot_text),
            description="",
            pages=[{"url": url, "title": self._extract_title(snapshot_text), "status": "completed"}],
            interactive_elements=self._extract_elements(snapshot_text),
            navigation_links=[],
            forms=[],
            sections=[],
        )

    async def execute_test_case(
        self,
        case: dict,
        callback: Optional[Callable] = None,
    ) -> TestCaseResult:
        """执行单条测试用例"""
        case_id = case.get("id", "unknown")
        case_title = case.get("title", "")
        start_url = case.get("page_url", "")
        steps_data = case.get("steps", [])

        self.logger.info(f"[PlaywrightMCP] 执行用例: {case_title}")
        await self._ensure_connected()

        start_time = time.time()
        step_results: list[StepResult] = []

        try:
            # 导航到目标页面
            if start_url:
                if callback:
                    await callback({"type": "step", "step": 0, "action": "navigate", "status": "running"})
                await self._call_tool("browser_navigate", {"url": start_url})

            # 执行每个步骤
            for i, step in enumerate(steps_data):
                action = step.get("action", "")
                target = step.get("target", "")
                value = step.get("value", "")
                step_num = i + 1

                step_start = time.time()
                step_error = ""

                try:
                    if callback:
                        await callback({
                            "type": "step", "step": step_num,
                            "action": action, "target": target,
                            "status": "running",
                        })

                    if action == "navigate":
                        await self._call_tool("browser_navigate", {"url": target})
                    elif action == "click" or action == "aiTap":
                        await self._call_tool("browser_click", {"selector": target})
                    elif action == "input" or action == "aiInput":
                        await self._call_tool("browser_type", {
                            "selector": target,
                            "text": value,
                        })
                    elif action == "assert" or action == "aiAssert":
                        snapshot = await self._call_tool("browser_snapshot", {})
                        if target not in str(snapshot):
                            raise AssertionError(f"断言失败: 未找到 '{target}'")
                    elif action == "aiQuery":
                        await self._call_tool("browser_snapshot", {})
                    else:
                        self.logger.warning(f"未知操作: {action}")

                    step_status = "passed"
                except Exception as e:
                    step_error = str(e)
                    step_status = "failed"

                step_duration = int((time.time() - step_start) * 1000)
                step_results.append(StepResult(
                    step=step_num, action=action, target=target,
                    status=step_status, error=step_error,
                    duration_ms=step_duration,
                ))

                if callback:
                    await callback({
                        "type": "step", "step": step_num,
                        "action": action, "target": target,
                        "status": step_status, "error": step_error,
                    })

                if step_status == "failed":
                    break

            # 整体结果
            total_duration = int((time.time() - start_time) * 1000)
            failed_steps = [s for s in step_results if s.status == "failed"]
            overall_status = "passed" if not failed_steps else "failed"

            return TestCaseResult(
                case_id=case_id,
                case_title=case_title,
                status=overall_status,
                duration_ms=total_duration,
                error=failed_steps[0].error if failed_steps else "",
                steps=step_results,
            )

        except Exception as e:
            total_duration = int((time.time() - start_time) * 1000)
            return TestCaseResult(
                case_id=case_id,
                case_title=case_title,
                status="error",
                duration_ms=total_duration,
                error=str(e),
                steps=step_results,
            )

    async def generate_test_cases(
        self,
        spec: str,
        context: Optional[dict] = None,
        callback: Optional[Callable] = None,
    ) -> list[dict]:
        """AI 生成测试用例（通过 LLM）"""
        self.logger.info(f"[PlaywrightMCP] 生成测试用例...")

        system_prompt = (
            "你是一个 Web 测试专家。根据需求规格生成测试用例。"
            "每个用例包含: title, page_url, steps (action/target/value), priority。"
            "可用操作: navigate, click, type, assert。"
            "返回 JSON 数组。"
        )

        content = await self._call_llm(
            f"需求规格:\n{spec}\n\n请生成测试用例的 JSON 数组。",
            system_prompt,
        )

        try:
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]
            cases = json.loads(cleaned)
            return cases if isinstance(cases, list) else []
        except json.JSONDecodeError as e:
            self.logger.error(f"LLM 返回非 JSON: {e}")
            return []

    async def health_check(self) -> dict:
        """健康检查 — 验证 MCP 连接"""
        try:
            await self._ensure_connected()
            return {
                "engine": "playwright_mcp",
                "available": True,
                "transport": self.transport,
            }
        except Exception as e:
            return {
                "engine": "playwright_mcp",
                "available": False,
                "transport": self.transport,
                "error": str(e),
            }

    async def cleanup(self):
        """断开 MCP 连接"""
        if self._client:
            try:
                await self._client.__aexit__(None, None, None)
            except Exception:
                pass
            self._client = None
            self._session = None

    # ── 辅助方法 ──

    def _extract_title(self, snapshot: str) -> str:
        """从快照文本中提取页面标题"""
        for line in snapshot.split("\n"):
            line = line.strip()
            if line.startswith("# ") or line.startswith("heading"):
                return line.lstrip("# ").lstrip("heading ").strip()
        return ""

    def _extract_elements(self, snapshot: str) -> list[dict]:
        """从快照文本中提取可交互元素"""
        elements = []
        for line in snapshot.split("\n"):
            line = line.strip()
            if any(tag in line for tag in ["button", "link", "input", "[", "("]):
                elements.append({"text": line, "type": "unknown"})
        return elements

    async def _call_llm(self, prompt: str, system_prompt: str = None) -> str:
        """调用 LLM"""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=self.config.api_key,
            base_url=self.config.base_url,
        )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await client.chat.completions.create(
            model=self.config.model_name,
            messages=messages,
            temperature=0.3,
        )

        return response.choices[0].message.content or ""
