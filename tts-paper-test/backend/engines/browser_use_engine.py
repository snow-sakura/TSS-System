"""Browser Use Engine — Python AI Agent 引擎

Browser Use 是一个开源的 Python 库（105k+ Stars），让 AI Agent 像人类一样使用浏览器。
它通过 Playwright 控制浏览器，支持多种 LLM，在 Odysseys 基准测试中排名第一（87.4%）。

使用方式:
    pip install browser-use playwright
    playwright install chromium

参考: https://github.com/browser-use/browser-use

说明: browser-use 依赖按需懒加载，未安装时 health_check 返回不可用，
      execute/explore 抛出清晰的安装提示错误。
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


class BrowserUseEngine(BaseEngine):
    """Browser Use 引擎 — AI Agent 驱动浏览器自动化

    通过 browser-use 的 Agent + LLM 组合，将测试步骤转换为自然语言任务，
    由 AI Agent 自主驱动浏览器执行。支持结构化步骤（action/target/value）
    与自然语言探索两种模式。
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        super().__init__(config)
        self._agent = None
        self._browser = None
        self._llm = None
        self._import_error: Optional[str] = None

    # ── 依赖管理 ──

    def _load_deps(self):
        """懒加载 browser-use 依赖，失败时记录导入错误"""
        if self._import_error is not None:
            raise RuntimeError(self._import_error)
        try:
            import browser_use  # noqa: F401
        except ImportError as e:
            self._import_error = (
                "browser-use 未安装。运行: pip install browser-use playwright"
                f"（原始错误: {e}）"
            )
            raise RuntimeError(self._import_error)

    def _build_llm(self):
        """构建 LLM 实例（基于 EngineConfig）"""
        from browser_use import ChatOpenAI

        kwargs: dict[str, Any] = {"model": self.config.model_name}
        if self.config.api_key:
            kwargs["api_key"] = self.config.api_key
        if self.config.base_url:
            kwargs["base_url"] = self.config.base_url
        if self.config.timeout_ms:
            kwargs["timeout"] = self.config.timeout_ms / 1000
        return ChatOpenAI(**kwargs)

    def _build_browser(self):
        """构建 Browser 实例（headless 跟随配置）"""
        from browser_use import Browser

        return Browser(
            headless=self.config.headless,
            window_size={
                "width": self.config.viewport_width,
                "height": self.config.viewport_height,
            },
        )

    async def _run_agent(self, task: str, max_steps: int = 30) -> dict:
        """运行 Agent 并返回执行摘要

        Returns:
            {
                "success": bool,
                "result": str,           # final_result 文本
                "urls": list[str],       # 访问过的 URL
                "actions": list[str],    # 执行过的动作名
                "errors": list[str],     # 步骤错误
                "steps": int,
                "duration_ms": int,
            }
        """
        from browser_use import Agent

        start = time.time()
        self._llm = self._build_llm()
        self._browser = self._build_browser()
        self._agent = Agent(
            task=task,
            llm=self._llm,
            browser=self._browser,
            max_steps=max_steps,
        )
        history = await self._agent.run()

        errors = [e for e in (history.errors() or []) if e]
        return {
            "success": bool(history.is_successful()) and not errors,
            "result": history.final_result() or "",
            "urls": history.urls() or [],
            "actions": history.action_names() or [],
            "errors": errors,
            "steps": history.number_of_steps() or 0,
            "duration_ms": int((time.time() - start) * 1000),
        }

    # ── 引擎接口实现 ──

    async def explore(
        self,
        url: str,
        callback: Optional[Callable] = None,
    ) -> ExploreResult:
        """使用 Browser Use Agent 探索网页"""
        self._load_deps()
        self.logger.info(f"[BrowserUseEngine] 探索: {url}")

        task = (
            f"打开网页 {url}，然后完成以下探索任务：\n"
            "1. 记录页面标题（title）\n"
            "2. 列出页面主要的可交互元素（按钮、链接、输入框），给出文本与类型\n"
            "3. 列出页面中的表单及其字段\n"
            "4. 列出主导航链接\n"
            "5. 概述页面主要区块/功能\n"
            "请以结构化文本输出结果。"
        )

        if callback:
            await callback(
                {"type": "status", "message": "Browser Use Agent 正在探索页面..."}
            )

        summary = await self._run_agent(task, max_steps=25)

        if callback:
            await callback(
                {
                    "type": "status",
                    "message": f"探索完成: 访问 {len(summary['urls'])} 个页面, "
                    f"执行 {summary['steps']} 步",
                }
            )

        title = ""
        interactive_elements: list[dict] = []
        forms: list[dict] = []
        links: list[str] = []
        sections: list[str] = []
        description = summary["result"]

        # 从最终结果中粗粒度提取（真实解析依赖 Agent 输出格式，这里做宽松解析）
        for line in (summary["result"] or "").splitlines():
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

        # 补充 URL 列表为访问页面
        pages = [
            {"url": u, "title": title, "status": "completed"} for u in summary["urls"]
        ] or [{"url": url, "title": title, "status": "completed"}]

        return ExploreResult(
            url=url,
            title=title,
            description=description,
            pages=pages,
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
        """使用 Browser Use 执行测试用例"""
        self._load_deps()
        case_id = case.get("id", "unknown")
        case_title = case.get("title", "")
        start_url = case.get("page_url", "")
        steps_data = case.get("steps", [])

        self.logger.info(f"[BrowserUseEngine] 执行用例: {case_title}")

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

        task = (
            f"执行以下 Web 测试用例「{case_title}」的步骤，逐步操作浏览器：\n"
            + "\n".join(step_lines)
            + "\n\n请按顺序严格执行。最后输出执行结果摘要。"
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

        try:
            summary = await self._run_agent(task, max_steps=30)

            step_results: list[StepResult] = []
            for i, action_name in enumerate(summary["actions"]):
                step_results.append(
                    StepResult(
                        step=i + 1,
                        action=action_name,
                        target="",
                        status="passed",
                        duration_ms=0,
                    )
                )

            overall_status = "passed" if summary["success"] else "failed"
            error = "; ".join(summary["errors"]) if summary["errors"] else ""

            if callback:
                await callback(
                    {
                        "type": "case_complete",
                        "case_id": case_id,
                        "case_title": case_title,
                        "status": overall_status,
                        "duration_ms": summary["duration_ms"],
                        "error": error,
                    }
                )

            return TestCaseResult(
                case_id=case_id,
                case_title=case_title,
                status=overall_status,
                duration_ms=summary["duration_ms"],
                error=error,
                steps=step_results,
            )

        except Exception as e:
            self.logger.error(f"[BrowserUseEngine] 执行异常: {e}")
            if callback:
                await callback(
                    {
                        "type": "case_complete",
                        "case_id": case_id,
                        "case_title": case_title,
                        "status": "failed",
                        "error": str(e),
                    }
                )
            return TestCaseResult(
                case_id=case_id,
                case_title=case_title,
                status="failed",
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

    async def generate_test_cases(
        self,
        spec: str,
        context: Optional[dict] = None,
        callback: Optional[Callable] = None,
    ) -> list[dict]:
        """AI 根据需求规格生成测试用例（通过 LLM）"""
        self.logger.info(f"[BrowserUseEngine] 生成测试用例...")

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
        """检查 Browser Use 环境是否就绪"""
        try:
            self._load_deps()
            return {
                "engine": "browser_use",
                "available": True,
                "model": self.config.model_name,
                "headless": self.config.headless,
            }
        except RuntimeError as e:
            return {
                "engine": "browser_use",
                "available": False,
                "error": str(e),
            }
        except Exception as e:
            return {
                "engine": "browser_use",
                "available": False,
                "error": f"依赖加载失败: {e}",
            }

    async def cleanup(self):
        """清理浏览器资源"""
        if self._browser:
            try:
                await self._browser.close()
            except Exception as e:
                self.logger.warning(f"浏览器关闭失败: {e}")
        self._browser = None
        self._agent = None
        self._llm = None

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
