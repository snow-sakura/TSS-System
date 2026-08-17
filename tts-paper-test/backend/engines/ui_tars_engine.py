"""UI-TARS Engine — 多模态 GUI Agent 引擎

UI-TARS Desktop 是字节跳动开源的多模态 GUI Agent（38k+ Stars），
基于 UI-TARS VLM 模型驱动，支持本地桌面和浏览器操作。
支持 Hugging Face 和火山引擎等多种 VLM 后端。

接入方式:
    UI-TARS Desktop 自带 Tarko Agent Server（Express HTTP 服务），
    提供 one-shot 查询端点:
        POST /api/v1/oneshot/query
        Body: { "query": "..." }
        Response: { "sessionId": "...", "result": "..." }

    默认地址: http://127.0.0.1:3000 （可通过 EngineConfig.extra["base_url"] 覆盖）

参考: https://github.com/bytedance/UI-TARS-desktop
"""

import json
import time
from typing import Any, Callable, Optional

import httpx

from .base import (
    BaseEngine,
    EngineConfig,
    ExploreResult,
    TestCaseResult,
    StepResult,
)


class UITarsEngine(BaseEngine):
    """UI-TARS 引擎 — 通过 HTTP 调用本地 UI-TARS Desktop Agent Server

    将测试步骤/探索任务转换为自然语言 query，POST 到 UI-TARS 的
    one-shot API 执行，解析返回的 result 文本作为执行结果。
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        super().__init__(config)
        extra = config.extra if config else {}
        # 允许通过 extra 覆盖服务地址与超时
        self.base_url: str = str(
            extra.get("base_url") or "http://127.0.0.1:3000"
        ).rstrip("/")
        self.timeout: float = float(extra.get("timeout") or 60)

    # ── 连接管理 ──

    def _oneshot_url(self) -> str:
        """one-shot 查询端点 URL"""
        return f"{self.base_url}/api/v1/oneshot/query"

    async def _oneshot(self, query: str) -> dict:
        """调用 UI-TARS one-shot API

        Returns:
            {"session_id": str, "result": str}

        Raises:
            RuntimeError: 服务不可达 / 返回错误
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    self._oneshot_url(),
                    json={"query": query},
                    headers={"Content-Type": "application/json"},
                )
        except httpx.HTTPError as e:
            raise RuntimeError(
                f"无法连接 UI-TARS 服务 ({self.base_url})。"
                f"请确认 UI-TARS Desktop 已启动（启动后可访问 {self._oneshot_url()}）。"
                f"原始错误: {e}"
            ) from e

        if resp.status_code != 200:
            try:
                detail = resp.json()
            except Exception:
                detail = {"error": resp.text[:200]}
            raise RuntimeError(
                f"UI-TARS API 返回错误 (HTTP {resp.status_code}): "
                f"{json.dumps(detail, ensure_ascii=False)}"
            )

        data = resp.json()
        if not data.get("result"):
            raise RuntimeError(
                f"UI-TARS 未返回结果: {json.dumps(data, ensure_ascii=False)[:300]}"
            )
        return {
            "session_id": data.get("sessionId", ""),
            "result": str(data.get("result", "")),
        }

    # ── 引擎接口实现 ──

    async def explore(
        self,
        url: str,
        callback: Optional[Callable] = None,
    ) -> ExploreResult:
        """使用 UI-TARS 探索网页"""
        self.logger.info(f"[UITarsEngine] 探索: {url}")

        query = (
            f"请打开网页 {url} 并完成探索：\n"
            "1. 记录页面标题\n"
            "2. 列出主要可交互元素（按钮、链接、输入框）\n"
            "3. 列出表单字段\n"
            "4. 列出导航链接\n"
            "5. 概述页面主要功能区块\n"
            "请以结构化文本输出。"
        )

        if callback:
            await callback({"type": "status", "message": "UI-TARS 正在探索页面..."})

        try:
            data = await self._oneshot(query)
        except RuntimeError as e:
            if callback:
                await callback({"type": "status", "message": str(e)})
            raise

        result_text = data["result"]

        # 宽松解析 Agent 输出
        title = ""
        interactive_elements: list[dict] = []
        forms: list[dict] = []
        links: list[str] = []
        sections: list[str] = []
        for line in result_text.splitlines():
            line = line.strip()
            if not line:
                continue
            lower = line.lower()
            if lower.startswith(("标题", "title")):
                title = line.split(":", 1)[-1].strip() if ":" in line else line
            elif any(
                k in lower
                for k in ("按钮", "button", "链接", "link", "输入框", "input")
            ):
                interactive_elements.append({"text": line, "type": "unknown"})
            elif "表单" in lower or "form" in lower:
                forms.append({"text": line})
            elif "区块" in lower or "section" in lower:
                sections.append(line)
            elif lower.startswith(("http://", "https://")):
                links.append(line)

        return ExploreResult(
            url=url,
            title=title,
            description=result_text,
            pages=[{"url": url, "title": title, "status": "completed"}],
            interactive_elements=interactive_elements,
            forms=forms,
            navigation_links=links,
            sections=sections,
        )

    async def execute_test_case(
        self,
        case: dict,
        callback: Optional[Callable] = None,
    ) -> TestCaseResult:
        """使用 UI-TARS 执行测试用例"""
        case_id = case.get("id", "unknown")
        case_title = case.get("title", "")
        start_url = case.get("page_url", "")
        steps_data = case.get("steps", [])

        self.logger.info(f"[UITarsEngine] 执行用例: {case_title}")

        # 将结构化步骤转换为自然语言任务
        step_lines = []
        if start_url:
            step_lines.append(f"1. 打开网页 {start_url}")
        for i, step in enumerate(steps_data):
            action = step.get("action", "")
            target = step.get("target", "")
            value = step.get("value", "")
            desc = self._step_to_text(
                i + 1 + (1 if start_url else 0), action, target, value
            )
            if desc:
                step_lines.append(desc)

        if not step_lines:
            return TestCaseResult(
                case_id=case_id,
                case_title=case_title,
                status="failed",
                error="用例没有可执行的步骤",
            )

        query = (
            f"执行以下 Web 测试用例「{case_title}」的步骤，逐步操作浏览器：\n"
            + "\n".join(step_lines)
            + "\n\n请按顺序严格执行，最后输出执行结果摘要。"
        )

        if callback:
            await callback(
                {
                    "type": "case_start",
                    "case_id": case_id,
                    "case_title": case_title,
                    "status": "running",
                }
            )

        start = time.time()
        try:
            data = await self._oneshot(query)
            duration_ms = int((time.time() - start) * 1000)

            result_text = data["result"]
            failed = self._detect_failure(result_text)

            if callback:
                await callback(
                    {
                        "type": "case_complete",
                        "case_id": case_id,
                        "case_title": case_title,
                        "status": "failed" if failed else "passed",
                        "duration_ms": duration_ms,
                        "error": result_text[:500] if failed else "",
                    }
                )

            return TestCaseResult(
                case_id=case_id,
                case_title=case_title,
                status="failed" if failed else "passed",
                duration_ms=duration_ms,
                error=result_text[:500] if failed else "",
                steps=[
                    StepResult(
                        step=1,
                        action="ai_execute",
                        target=case_title,
                        status="passed" if not failed else "failed",
                        error="" if not failed else result_text[:500],
                        duration_ms=duration_ms,
                    )
                ],
            )

        except RuntimeError as e:
            duration_ms = int((time.time() - start) * 1000)
            if callback:
                await callback(
                    {
                        "type": "case_complete",
                        "case_id": case_id,
                        "case_title": case_title,
                        "status": "failed",
                        "duration_ms": duration_ms,
                        "error": str(e),
                    }
                )
            return TestCaseResult(
                case_id=case_id,
                case_title=case_title,
                status="failed",
                duration_ms=duration_ms,
                error=str(e),
            )

    @staticmethod
    def _step_to_text(idx: int, action: str, target: str, value: str) -> str:
        """将结构化步骤转换为自然语言指令"""
        action_map = {
            "navigate": lambda: f"{idx}. 导航到 {target or value}",
            "click": lambda: f"{idx}. 点击元素「{target}」",
            "aiTap": lambda: f"{idx}. 点击元素「{target}」",
            "type": lambda: f"{idx}. 在「{target}」输入文本「{value}」",
            "input": lambda: f"{idx}. 在「{target}」输入文本「{value}」",
            "aiInput": lambda: f"{idx}. 在「{target}」输入文本「{value}」",
            "assert": lambda: f"{idx}. 断言页面上存在「{target}」",
            "aiAssert": lambda: f"{idx}. 断言页面上存在「{target}」",
            "aiQuery": lambda: f"{idx}. 查询并返回「{target}」的内容",
            "scroll": lambda: f"{idx}. 滚动页面到「{target}」",
        }
        fn = action_map.get(action)
        if fn:
            return fn()
        if target or value:
            return f"{idx}. {action}: {target} {value}".strip()
        return ""

    @staticmethod
    def _detect_failure(result_text: str) -> bool:
        """从 Agent 输出文本中检测执行失败"""
        failure_markers = (
            "失败",
            "错误",
            "无法",
            "未能",
            "失败:",
            "error",
            "failed",
            "exception",
            "timeout",
            "not found",
            "找不到",
            "超时",
        )
        lower = result_text.lower()
        return any(marker in lower for marker in failure_markers)

    async def generate_test_cases(
        self,
        spec: str,
        context: Optional[dict] = None,
        callback: Optional[Callable] = None,
    ) -> list[dict]:
        """AI 根据需求规格生成测试用例（通过 LLM）"""
        self.logger.info(f"[UITarsEngine] 生成测试用例...")

        system_prompt = (
            "你是一个 Web 测试专家。根据用户提供的需求规格，生成详细的 Web 测试用例。"
            "每个用例包含: title, steps (action/target/value), page_url, priority。"
            "可用操作: navigate, click, type, assert, aiQuery。"
            "返回 JSON 数组，不要包裹 markdown 代码块。"
        )

        context_str = ""
        if context:
            context_str = (
                f"\n额外上下文:\n{json.dumps(context, ensure_ascii=False, indent=2)}"
            )

        prompt = f"需求规格:\n{spec}\n{context_str}\n请生成测试用例的 JSON 数组。"

        content = await self._call_llm(prompt, system_prompt)

        try:
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
        """检查 UI-TARS Desktop 服务是否可访问"""
        try:
            # 轻量探测：GET 根路径或发起一次最小查询
            async with httpx.AsyncClient(timeout=3) as client:
                try:
                    resp = await client.get(f"{self.base_url}/")
                    reachable = resp.status_code < 500
                    detail = f"HTTP {resp.status_code}"
                except httpx.HTTPError:
                    reachable = False
                    detail = "连接失败"
            return {
                "engine": "ui_tars",
                "available": reachable,
                "base_url": self.base_url,
                "error": (
                    ""
                    if reachable
                    else f"无法访问 {self.base_url}，请启动 UI-TARS Desktop"
                ),
                "detail": detail,
            }
        except Exception as e:
            return {
                "engine": "ui_tars",
                "available": False,
                "base_url": self.base_url,
                "error": f"健康检查异常: {e}",
            }

    async def cleanup(self):
        """清理资源（无持久连接）"""
        pass

    # ── 辅助方法 ──

    async def _call_llm(self, prompt: str, system_prompt: Optional[str] = None) -> str:
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
