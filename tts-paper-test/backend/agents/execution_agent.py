"""Web自动化测试执行Agent - 基于midscene.js"""

import asyncio
import json
import tempfile
from pathlib import Path
from typing import Optional, Callable

from .base_agent import BaseAgent

# 动作别名归一化：中文操作标签 / ai* 驼峰 → 引擎标准动作
ACTION_ALIASES = {
    "打开页面": "navigate",
    "点击": "click",
    "输入": "input",
    "选择": "select",
    "悬浮": "hover",
    "断言": "assert",
    "等待": "wait",
    "滚动": "scroll",
    "AI点击": "ai_tap",
    "AI输入": "ai_input",
    "AI断言": "ai_assert",
    "AI查询": "ai_query",
    "aiTap": "ai_tap",
    "aiInput": "ai_input",
    "aiAssert": "ai_assert",
    "aiQuery": "ai_query",
    "click": "click",
    "input": "input",
    "type": "input",
    "select": "select",
    "hover": "hover",
    "assert": "assert",
    "wait": "wait",
    "scroll": "scroll",
    "navigate": "navigate",
}


class ExecutionAgent(BaseAgent):
    """AI Web测试执行Agent

    将TestGenerator生成的测试用例步骤翻译为midscene.js脚本，
    通过Python子进程调用Node.js运行，收集执行结果。
    """

    def __init__(
        self,
        model_name: str = "qwen3.7-plus",
        api_key: str = "",
        base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model_family: str = "qwen3",
    ):
        super().__init__(
            name="execution_agent",
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
        )
        self.model_family = model_family

    async def run(
        self, project_id: int, test_cases: list[dict], callback=None
    ) -> list[dict]:
        """执行测试用例

        Args:
            project_id: 项目ID
            test_cases: 测试用例列表（来自TestGenerator的steps格式）
            callback: 进度回调 async def callback(event: dict)

        Returns:
            执行结果列表
        """
        self.logger.info(f"开始执行 {len(test_cases)} 条测试用例, project={project_id}")
        results = []

        for idx, case in enumerate(test_cases):
            case_id = case.get("id", idx + 1)
            case_title = case.get("title", f"测试用例 {case_id}")

            if callback:
                await callback(
                    {
                        "type": "case_start",
                        "case_id": case_id,
                        "case_title": case_title,
                        "index": idx + 1,
                        "total": len(test_cases),
                    }
                )

            try:
                url = case.get("page_url", "")
                steps = case.get("steps", [])
                if not url:
                    raise ValueError("测试用例缺少目标URL (page_url)")

                # 生成执行脚本
                script = self._generate_exec_script(url, steps, case_title)
                script_path = Path(
                    tempfile.mktemp(suffix=".mjs", dir=str(Path(__file__).parent))
                )
                script_path.write_text(script, encoding="utf-8")

                # 执行脚本
                result = await self._run_script(script_path, callback)
                result["case_id"] = case_id
                result["case_title"] = case_title
                results.append(result)

                if callback:
                    await callback(
                        {
                            "type": "case_complete",
                            "case_id": case_id,
                            "case_title": case_title,
                            "status": result.get("status", "failed"),
                            "duration_ms": result.get("duration_ms", 0),
                            "error": result.get("error", ""),
                            "screenshot": result.get("screenshot", ""),
                        }
                    )

            except Exception as e:
                self.logger.error(f"执行用例失败 {case_title}: {e}")
                result = {
                    "case_id": case_id,
                    "case_title": case_title,
                    "status": "failed",
                    "error": str(e),
                    "duration_ms": 0,
                    "screenshot": "",
                }
                results.append(result)
                if callback:
                    await callback(
                        {
                            "type": "case_complete",
                            "case_id": case_id,
                            "case_title": case_title,
                            "status": "failed",
                            "duration_ms": 0,
                            "error": str(e),
                            "screenshot": "",
                        }
                    )
            finally:
                # 清理临时脚本
                if "script_path" in locals():
                    script_path.unlink(missing_ok=True)

        self.logger.info(f"执行完成: {len(results)} 条用例")
        return results

    @staticmethod
    def _esc(s) -> str:
        """转义字符串用于 JS 单引号字符串字面量"""
        return str(s or "").replace("'", "\\'").replace('"', '\\"')

    @staticmethod
    def _infer_backup_type(locator: str) -> str:
        """推断备用定位器的策略类型（与 locatorFor 的 JS 规则保持一致）"""
        s = locator.strip()
        if s.startswith("//"):
            return "xpath"
        if s.lower().startswith("text="):
            return "text"
        if s.startswith("#") or s.startswith(".") or s.startswith("["):
            return "css"
        return "css"

    def _build_locate_block(self, step: dict) -> Optional[str]:
        """构建元素定位代码块（主定位器 + 备用链 strategies + 超时）

        步骤无 locator 时返回 None，调用方回退到 AI 视觉定位。
        """
        locator = step.get("locator")
        if not locator:
            return None
        locator_type = step.get("locator_type") or "css"
        backup_locators = step.get("backup_locators") or []
        timeout_ms = int(step.get("wait_timeout") or 5) * 1000

        strategies = [{"type": locator_type, "selector": locator}]
        for b in backup_locators:
            if b and b != locator:
                strategies.append({"type": self._infer_backup_type(b), "selector": b})

        return (
            f"        const strategies = {json.dumps(strategies, ensure_ascii=False)};\n"
            f"        const el = await waitAndLocate(page, strategies, {timeout_ms});"
        )

    def _gen_structured_code(
        self, step: dict, step_num: int, action: str
    ) -> Optional[str]:
        """生成结构化操作代码（确定性 Playwright 原生定位 + 断言）

        支持动作: navigate / click / input / select / hover / scroll / wait / assert
        断言类型: visible / hidden / text / attribute / value / url / enabled / disabled
        返回 None 时由调用方回退到 AI 视觉定位。
        """
        target = self._esc(step.get("target", ""))
        value = self._esc(step.get("value", ""))
        value_raw = step.get("value", "")

        if action == "navigate":
            url = self._esc(step.get("url") or step.get("target") or "")
            if not url:
                return None
            return (
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'navigate', target: '{target}', status: 'running' }});\n"
                f"        await page.goto('{url}', {{ waitUntil: 'networkidle', timeout: 30000 }});\n"
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'navigate', target: '{target}', status: 'passed' }});"
            )

        if action == "wait":
            ms = int(value_raw) * 1000 if str(value_raw).isdigit() else 1000
            return (
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'wait', target: '{target}', status: 'running' }});\n"
                f"        await new Promise(r => setTimeout(r, {ms}));\n"
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'wait', target: '{target}', status: 'passed' }});"
            )

        locate_block = self._build_locate_block(step)
        if not locate_block:
            return None
        force = "true" if step.get("force_action") else "false"
        # 步骤事件携带定位元信息（供步骤明细展示）
        loc_js = (
            f"locator: '{self._esc(step.get('locator'))}', "
            f"locator_type: '{step.get('locator_type') or 'css'}', "
        )

        if action in ("click", "ai_tap"):
            return (
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'tap', target: '{target}', {loc_js}status: 'running' }});\n"
                f"{locate_block}\n"
                f"        await clickEl(el, {force});\n"
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'tap', target: '{target}', status: 'passed' }});"
            )
        if action in ("input", "ai_input"):
            return (
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'input', target: '{target}', {loc_js}status: 'running' }});\n"
                f"{locate_block}\n"
                f"        await fillEl(el, '{value}', {force});\n"
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'input', target: '{target}', status: 'passed' }});"
            )
        if action == "select":
            return (
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'select', target: '{target}', {loc_js}status: 'running' }});\n"
                f"{locate_block}\n"
                f"        await el.selectOption('{value}');\n"
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'select', target: '{target}', status: 'passed' }});"
            )
        if action == "hover":
            return (
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'hover', target: '{target}', {loc_js}status: 'running' }});\n"
                f"{locate_block}\n"
                f"        await el.hover();\n"
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'hover', target: '{target}', status: 'passed' }});"
            )
        if action == "scroll":
            return (
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'scroll', target: '{target}', {loc_js}status: 'running' }});\n"
                f"{locate_block}\n"
                f"        await el.scrollIntoViewIfNeeded();\n"
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'scroll', target: '{target}', status: 'passed' }});"
            )
        if action in ("assert", "ai_assert"):
            # 结构化断言：逐条执行并收集结果（成功/失败均记录），失败最后统一判定
            assertions = step.get("assertions") or []
            lines = [
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'assert', target: '{target}', {loc_js}status: 'running' }});",
                "        const assertionResults = [];",
            ]
            lines.append(locate_block)
            if assertions:
                for a in assertions:
                    a_type = a.get("type", "visible")
                    expected = self._esc(a.get("expected", ""))
                    attr = self._esc(a.get("attribute", ""))
                    if a_type == "url":
                        lines.append(
                            f"        {{ try {{ await assertUrl(page, '{expected}'); "
                            f"assertionResults.push({{ type: 'url', expected: '{expected}', attribute: '', actual: page.url(), passed: true }}); }} "
                            f"catch (e) {{ assertionResults.push({{ type: 'url', expected: '{expected}', attribute: '', actual: e.message, passed: false }}); }} }}"
                        )
                    else:
                        lines.append(
                            f"        {{ try {{ await assertOn(el, {{ type: '{a_type}', expected: '{expected}', attribute: '{attr}' }}); "
                            f"assertionResults.push({{ type: '{a_type}', expected: '{expected}', attribute: '{attr}', actual: 'ok', passed: true }}); }} "
                            f"catch (e) {{ assertionResults.push({{ type: '{a_type}', expected: '{expected}', attribute: '{attr}', actual: e.message, passed: false }}); }} }}"
                        )
            else:
                lines.append(
                    f"        await el.waitFor({{ state: 'visible', timeout: {int(step.get('wait_timeout') or 5) * 1000} }});"
                )
            lines.append(
                f"        sendProgress({{ type: 'step', step: {step_num}, action: 'assert', target: '{target}', status: 'passed', assertion_results: assertionResults }});"
            )
            lines.append(
                "        const failedAssertions = assertionResults.filter(r => !r.passed);"
            )
            lines.append(
                "        if (failedAssertions.length > 0) { "
                "const errMsg = `断言失败: ${{failedAssertions.map(r => r.type + (r.attribute ? ':' + r.attribute : '')).join(', ')}}`; "
                f"sendProgress({{ type: 'step', step: {step_num}, action: 'assert', target: '{target}', status: 'failed', error: errMsg, assertion_results: assertionResults }}); "
                "throw new Error(errMsg); }"
            )
            return "\n".join(lines)
        return None

    def _generate_exec_script(
        self, url: str, steps: list[dict], case_title: str
    ) -> str:
        """将测试用例步骤翻译为midscene.js执行脚本

        steps格式: [{action: "...", target: "...", value?: "...", assertions?: [...]}]
        - 结构化动作（navigate/click/input/select/hover/scroll/wait/assert）
          生成确定性 Playwright 原生定位代码（含备用定位链、断言校验）；
        - AI 动作（ai_tap/ai_input/ai_assert/ai_query）使用 midscene 视觉定位；
        - 中文操作标签（打开页面/点击/输入…）自动归一化到标准动作。
        """
        # 构建步骤代码
        steps_code = []
        for i, step in enumerate(steps):
            step_num = i + 1
            raw_action = step.get("action", "")
            action = ACTION_ALIASES.get(raw_action, raw_action)

            # 结构化动作优先（navigate/wait 无需定位器；其余需要 locator）
            structured = self._gen_structured_code(step, step_num, action or "")
            if structured:
                steps_code.append(structured)
                continue

            target = self._esc(step.get("target", ""))
            value = self._esc(step.get("value", ""))

            if action == "ai_tap":
                steps_code.append(
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'tap', target: '{target}', status: 'running' }});\n"
                    f"        await agent.aiTap('{target}');\n"
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'tap', target: '{target}', status: 'passed' }});"
                )
            elif action == "ai_input":
                steps_code.append(
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'input', target: '{target}', status: 'running' }});\n"
                    f"        await agent.aiInput('{target}', '{value}');\n"
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'input', target: '{target}', status: 'passed' }});"
                )
            elif action == "ai_assert":
                steps_code.append(
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'assert', target: '{target}', status: 'running' }});\n"
                    f"        await agent.aiAssert('{target}');\n"
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'assert', target: '{target}', status: 'passed' }});"
                )
            elif action == "ai_query":
                steps_code.append(
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'query', target: '{target}', status: 'running' }});\n"
                    f"        const queryResult = await agent.aiQuery({{ result: '{target}' }});\n"
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'query', target: '{target}', status: 'passed', data: queryResult }});"
                )
            else:
                self.logger.warning(f"未知操作类型: {raw_action}, 跳过步骤 {step_num}")

        steps_block = "\n".join(steps_code)

        return f"""import {{ chromium }} from 'playwright';
import {{ PlaywrightAgent }} from '@midscene/web/playwright';

const startTime = Date.now();

const browser = await chromium.launch({{ headless: true }});
const page = await browser.newPage({{ viewport: {{ width: 1280, height: 720 }} }});

const sendProgress = (msg) => {{
    process.stdout.write(JSON.stringify(msg) + '\\n');
}};

// ===== 结构化定位器（对象库元素）支持 =====
// 按 locator_type 将定位器转换为 Playwright locator
const locatorFor = (page, type, selector) => {{
    switch (type) {{
        case 'xpath': return page.locator('xpath=' + selector);
        case 'text': return page.getByText(selector);
        case 'id': return page.locator('#' + selector);
        case 'name': return page.locator(`[name="${{selector}}"]`);
        case 'placeholder': return page.getByPlaceholder(selector);
        default: return page.locator(selector);
    }}
}};

// 带备用链的查找：依次尝试 strategies（主定位器 + backup_locators），全部失败则抛错
async function waitAndLocate(page, strategies, timeoutMs) {{
    let lastErr = null;
    for (let i = 0; i < strategies.length; i++) {{
        const s = strategies[i];
        try {{
            const el = locatorFor(page, s.type, s.selector);
            await el.waitFor({{ state: 'visible', timeout: timeoutMs }});
            return el;
        }} catch (e) {{
            lastErr = e;
            sendProgress({{ type: 'status', message: `定位器 #${{i + 1}} 失败，尝试下一个: ${{s.selector}}` }});
        }}
    }}
    throw new Error(`元素定位失败（共尝试 ${{strategies.length}} 个定位器）: ${{lastErr ? lastErr.message : ''}}`);
}}

// 点击（force_action 时强制点击，忽略遮挡/不可交互）
async function clickEl(el, force) {{
    await el.click({{ force: force }});
}}

// 输入（先点击聚焦，支持强制）
async function fillEl(el, value, force) {{
    await el.click({{ force: force }}).catch(() => {{}});
    await el.fill(value, {{ force: force }});
}}

// ===== 结构化断言（不依赖 expect，纯 Playwright API 组合） =====
// 支持类型: visible / hidden / text / attribute / value / enabled / disabled
async function assertOn(el, assertion) {{
    const {{ type, expected, attribute }} = assertion;
    switch (type) {{
        case 'visible':
            if (!(await el.isVisible())) throw new Error('断言失败: 期望元素可见，实际不可见');
            break;
        case 'hidden':
            if (await el.isVisible()) throw new Error('断言失败: 期望元素隐藏，实际可见');
            break;
        case 'text': {{
            const t = (await el.textContent()) || '';
            if (!t.includes(expected)) throw new Error(`断言失败: 期望文本包含 "${{expected}}"，实际 "${{t.slice(0, 50)}}"`);
            break;
        }}
        case 'attribute': {{
            const v = await el.getAttribute(attribute);
            if (v !== expected) throw new Error(`断言失败: 属性 ${{attribute}} 期望 "${{expected}}"，实际 "${{v}}"`);
            break;
        }}
        case 'value': {{
            const v = await el.inputValue().catch(() => '');
            if (v !== expected) throw new Error(`断言失败: 值期望 "${{expected}}"，实际 "${{v}}"`);
            break;
        }}
        case 'enabled':
            if (await el.isDisabled()) throw new Error('断言失败: 期望元素可用，实际禁用');
            break;
        case 'disabled':
            if (!(await el.isDisabled())) throw new Error('断言失败: 期望元素禁用，实际可用');
            break;
        default:
            throw new Error(`不支持的断言类型: ${{type}}`);
    }}
}}

// URL 断言
async function assertUrl(page, expected) {{
    const u = page.url();
    if (!u.includes(expected)) throw new Error(`断言失败: URL 期望包含 "${{expected}}"，实际 "${{u}}"`);
}}

try {{
    sendProgress({{ type: 'status', message: '正在访问目标页面...' }});
    await page.goto('{url}', {{ waitUntil: 'networkidle', timeout: 30000 }});

    const agent = new PlaywrightAgent(page, {{
        modelConfig: {{
            MIDSCENE_MODEL_NAME: '{self.model_name}',
            MIDSCENE_MODEL_API_KEY: '{self.api_key}',
            MIDSCENE_MODEL_BASE_URL: '{self.base_url}',
            MIDSCENE_MODEL_FAMILY: '{self.model_family}'
        }},
        generateReport: false,
    }});

    sendProgress({{ type: 'status', message: '开始执行测试步骤...' }});

    // 执行测试步骤
{steps_block}

    // 截图保存最终状态
    const screenshotPath = `/tmp/tss_exec_${{Date.now()}}.png`;
    await page.screenshot({{ path: screenshotPath, fullPage: false }});

    const duration = Date.now() - startTime;
    sendProgress({{
        type: 'result',
        data: {{
            status: 'passed',
            duration_ms: duration,
            screenshot: screenshotPath,
            steps_total: {len(steps)},
            message: '测试执行成功'
        }}
    }});

}} catch (error) {{
    const duration = Date.now() - startTime;
    let screenshotPath = '';
    try {{
        screenshotPath = `/tmp/tss_exec_error_${{Date.now()}}.png`;
        await page.screenshot({{ path: screenshotPath }});
    }} catch (e) {{}}

    process.stdout.write(JSON.stringify({{
        type: 'result',
        data: {{
            status: 'failed',
            duration_ms: duration,
            screenshot: screenshotPath,
            error: error.message,
            message: `测试执行失败: ${{error.message}}`
        }}
    }}) + '\\n');
}} finally {{
    await browser.close();
}}
"""

    async def _run_script(self, script_path: Path, callback=None) -> dict:
        """运行Node.js执行脚本"""
        cmd = ["node", str(script_path)]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        result_data = {
            "status": "failed",
            "duration_ms": 0,
            "screenshot": "",
            "error": "",
            "steps": [],
        }

        # 步骤事件收集：按 step 序号合并（running → passed/failed 覆盖）
        step_map: dict[int, dict] = {}

        async def read_output():
            nonlocal result_data
            async for line in process.stdout:
                line = line.decode().strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                    if msg.get("type") == "result":
                        result_data = msg.get("data", result_data)
                    elif msg.get("type") == "step":
                        step_no = msg.get("step")
                        if isinstance(step_no, int):
                            step_map[step_no] = {
                                "step": step_no,
                                "action": msg.get("action", ""),
                                "target": msg.get("target", ""),
                                "locator": msg.get("locator"),
                                "locator_type": msg.get("locator_type"),
                                "status": msg.get("status", "running"),
                                "error": msg.get("error", ""),
                                "duration_ms": msg.get("duration_ms", 0),
                                "assertion_results": msg.get("assertion_results") or [],
                            }
                    if callback:
                        await callback(msg)
                except json.JSONDecodeError:
                    self.logger.debug(f"Non-JSON output: {line}")

        async def read_errors():
            async for line in process.stderr:
                line = line.decode().strip()
                if line:
                    self.logger.error(f"Node.js stderr: {line}")

        await asyncio.gather(read_output(), read_errors())
        await process.wait()

        if process.returncode != 0:
            self.logger.error(f"脚本执行失败, returncode={process.returncode}")
            if result_data["status"] == "passed":
                result_data["status"] = "failed"
                result_data["error"] = f"Node.js进程退出码: {process.returncode}"

        # 步骤明细挂到结果（按步骤号排序）
        result_data["steps"] = sorted(step_map.values(), key=lambda s: s["step"])

        return result_data
