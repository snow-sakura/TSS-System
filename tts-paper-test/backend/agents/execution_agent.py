"""Web自动化测试执行Agent - 基于midscene.js"""

import asyncio
import json
import tempfile
from pathlib import Path
from typing import Optional, Callable

from .base_agent import BaseAgent


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
        super().__init__(name="execution_agent", model_name=model_name, api_key=api_key, base_url=base_url)
        self.model_family = model_family

    async def run(self, project_id: int, test_cases: list[dict], callback=None) -> list[dict]:
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
                await callback({
                    "type": "case_start",
                    "case_id": case_id,
                    "case_title": case_title,
                    "index": idx + 1,
                    "total": len(test_cases),
                })

            try:
                url = case.get("page_url", "")
                steps = case.get("steps", [])
                if not url:
                    raise ValueError("测试用例缺少目标URL (page_url)")

                # 生成执行脚本
                script = self._generate_exec_script(url, steps, case_title)
                script_path = Path(tempfile.mktemp(suffix=".mjs", dir=str(Path(__file__).parent)))
                script_path.write_text(script, encoding="utf-8")

                # 执行脚本
                result = await self._run_script(script_path, callback)
                result["case_id"] = case_id
                result["case_title"] = case_title
                results.append(result)

                if callback:
                    await callback({
                        "type": "case_complete",
                        "case_id": case_id,
                        "case_title": case_title,
                        "status": result.get("status", "failed"),
                        "duration_ms": result.get("duration_ms", 0),
                        "error": result.get("error", ""),
                        "screenshot": result.get("screenshot", ""),
                    })

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
                    await callback({
                        "type": "case_complete",
                        "case_id": case_id,
                        "case_title": case_title,
                        "status": "failed",
                        "duration_ms": 0,
                        "error": str(e),
                        "screenshot": "",
                    })
            finally:
                # 清理临时脚本
                if "script_path" in locals():
                    script_path.unlink(missing_ok=True)

        self.logger.info(f"执行完成: {len(results)} 条用例")
        return results

    def _generate_exec_script(self, url: str, steps: list[dict], case_title: str) -> str:
        """将测试用例步骤翻译为midscene.js执行脚本

        steps格式: [{action: "aiTap|aiInput|aiAssert|aiQuery", target: "...", value?: "..."}]
        翻译为PlaywrightAgent的对应方法调用。
        """
        # 构建步骤代码
        steps_code = []
        for i, step in enumerate(steps):
            action = step.get("action", "")
            target = step.get("target", "").replace("'", "\\'").replace('"', '\\"')
            value = step.get("value", "").replace("'", "\\'").replace('"', '\\"')

            step_num = i + 1
            if action == "aiTap":
                steps_code.append(f"        sendProgress({{ type: 'step', step: {step_num}, action: 'tap', target: '{target}', status: 'running' }});\n"
                    f"        await agent.aiTap('{target}');\n"
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'tap', target: '{target}', status: 'passed' }});")
            elif action == "aiInput":
                steps_code.append(f"        sendProgress({{ type: 'step', step: {step_num}, action: 'input', target: '{target}', status: 'running' }});\n"
                    f"        await agent.aiInput('{target}', '{value}');\n"
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'input', target: '{target}', status: 'passed' }});")
            elif action == "aiAssert":
                steps_code.append(f"        sendProgress({{ type: 'step', step: {step_num}, action: 'assert', target: '{target}', status: 'running' }});\n"
                    f"        await agent.aiAssert('{target}');\n"
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'assert', target: '{target}', status: 'passed' }});")
            elif action == "aiQuery":
                steps_code.append(f"        sendProgress({{ type: 'step', step: {step_num}, action: 'query', target: '{target}', status: 'running' }});\n"
                    f"        const queryResult = await agent.aiQuery({{ result: '{target}' }});\n"
                    f"        sendProgress({{ type: 'step', step: {step_num}, action: 'query', target: '{target}', status: 'passed', data: queryResult }});")
            else:
                self.logger.warning(f"未知操作类型: {action}, 跳过步骤 {step_num}")

        steps_block = "\n".join(steps_code)

        return f"""import {{ chromium }} from 'playwright';
import {{ PlaywrightAgent }} from '@midscene/web/playwright';

const startTime = Date.now();

const browser = await chromium.launch({{ headless: true }});
const page = await browser.newPage({{ viewport: {{ width: 1280, height: 720 }} }});

const sendProgress = (msg) => {{
    process.stdout.write(JSON.stringify(msg) + '\\n');
}};

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
""";

    async def _run_script(self, script_path: Path, callback=None) -> dict:
        """运行Node.js执行脚本"""
        cmd = ["node", str(script_path)]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        result_data = {"status": "failed", "duration_ms": 0, "screenshot": "", "error": ""}

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
                    elif callback:
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

        return result_data
