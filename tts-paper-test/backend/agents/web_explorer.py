"""Web探索Agent - 基于midscene.js"""

import asyncio
import json
import tempfile
from pathlib import Path
from typing import Optional

from .base_agent import BaseAgent


class WebExplorerAgent(BaseAgent):
    """AI Web探索Agent

    使用 midscene.js + Playwright 实现视觉驱动的网页探索。
    通过Python子进程调用Node.js脚本运行midscene.js。
    """

    def __init__(
        self,
        model_name: str = "qwen3.7-plus",
        api_key: str = "",
        base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model_family: str = "qwen3",
    ):
        super().__init__(
            name="web_explorer",
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
        )
        self.model_family = model_family

    async def run(self, url: str, callback=None) -> dict:
        """执行Agent任务 - 探索目标网站"""
        return await self.explore(url, callback)

    async def explore(self, url: str, callback=None) -> dict:
        """探索目标网站

        Args:
            url: 目标URL
            callback: 进度回调函数 async def callback(event: dict)

        Returns:
            探索结果: {pages: [...], structure: {...}}
        """
        self.logger.info(f"开始探索: {url}")

        if callback:
            await callback({"type": "status", "message": "正在启动浏览器..."})

        # 截图目录（与后端 uploads/screenshots 一致）
        screenshots_dir = str(
            Path(__file__).resolve().parent.parent / "uploads" / "screenshots"
        )

        # 生成Node.js探索脚本
        script = self._generate_script(url, screenshots_dir)
        script_path = Path(
            tempfile.mktemp(suffix=".mjs", dir=str(Path(__file__).parent))
        )
        script_path.write_text(script, encoding="utf-8")

        try:
            result = await self._run_script(script_path, callback)
            return result
        finally:
            script_path.unlink(missing_ok=True)

    def _generate_script(self, url: str, screenshots_dir: str) -> str:
        """生成midscene.js探索脚本"""
        return f"""import {{ chromium }} from 'playwright';
import {{ PlaywrightAgent }} from '@midscene/web/playwright';

const browser = await chromium.launch({{ headless: true }});
const page = await browser.newPage({{ viewport: {{ width: 1280, height: 720 }} }});

const result = {{ pages: [], structure: null }};

try {{
    // 发送进度
    const sendProgress = (msg) => {{
        process.stdout.write(JSON.stringify(msg) + '\\n');
    }};

    sendProgress({{ type: 'status', message: '正在访问目标网址...' }});

    await page.goto('{url}', {{ waitUntil: 'networkidle', timeout: 30000 }});

    // 截图目录（与后端 uploads/screenshots 一致）
    const fs = await import('fs');
    const path = await import('path');
    const screenshotsDir = path.resolve('{screenshots_dir}');
    fs.mkdirSync(screenshotsDir, {{ recursive: true }});
    const shotName = () => `explore_${{Date.now()}}_${{Math.random().toString(36).slice(2, 8)}}.png`;
    const shotPath = path.join(screenshotsDir, shotName());
    await page.screenshot({{ path: shotPath, fullPage: false }});

    const agent = new PlaywrightAgent(page, {{
        modelConfig: {{
            MIDSCENE_MODEL_NAME: '{self.model_name}',
            MIDSCENE_MODEL_API_KEY: '{self.api_key}',
            MIDSCENE_MODEL_BASE_URL: '{self.base_url}',
            MIDSCENE_MODEL_FAMILY: '{self.model_family}'
        }},
        generateReport: false,
    }});

    sendProgress({{ type: 'status', message: 'AI正在分析页面结构...' }});

    // 分析当前页面（domIncluded 以提取 id/name/href 等 DOM 属性）
    const pageInfo = await agent.aiQuery({{
        title: 'string, 页面标题',
        description: 'string, 页面描述（一句话概括页面功能）',
        url: 'string, 当前页面完整URL',
        navigation_links: 'string[], 所有导航链接和功能入口的URL',
        interactive_elements: '{{text: string, type: string, description: string, id: string, name: string, href: string}}[], 所有可交互元素，尽量包含其DOM属性(id/name/href)',
        forms: '{{action: string, fields: {{name: string, type: string, placeholder: string}}[]}}[], 所有表单',
        sections: '{{name: string, description: string}}[], 页面主要区域/板块及其功能描述'
    }}, {{ domIncluded: true }});

    result.structure = pageInfo;
    result.pages.push({{
        url: pageInfo.url || '{url}',
        title: pageInfo.title,
        description: pageInfo.description,
        elements: pageInfo.interactive_elements,
        sections: pageInfo.sections,
        forms: pageInfo.forms,
        screenshot: path.basename(shotPath),
        status: 'completed'
    }});

    sendProgress({{
        type: 'page_analyzed',
        url: pageInfo.url || '{url}',
        title: pageInfo.title,
        elements_count: pageInfo.interactive_elements?.length || 0,
        links_count: pageInfo.navigation_links?.length || 0,
        screenshot: path.basename(shotPath)
    }});

    // 探索子页面 (最多5个)
    const links = pageInfo.navigation_links || [];
    const maxSubPages = Math.min(links.length, 5);

    for (let i = 0; i < maxSubPages; i++) {{
        const link = links[i];
        if (!link || link.startsWith('javascript:') || link === '#') continue;

        try {{
            sendProgress({{ type: 'status', message: `正在探索子页面 ${{i + 1}}/${{maxSubPages}}: ${{link}}` }});

            const fullUrl = link.startsWith('http') ? link : new URL(link, '{url}').href;
            await page.goto(fullUrl, {{ waitUntil: 'networkidle', timeout: 15000 }});

            const subShotPath = path.join(screenshotsDir, shotName());
            await page.screenshot({{ path: subShotPath, fullPage: false }});

            const subPageInfo = await agent.aiQuery({{
                title: 'string, 页面标题',
                description: 'string, 页面描述（一句话概括页面功能）',
                url: 'string, 当前页面完整URL',
                interactive_elements: '{{text: string, type: string, description: string, id: string, name: string, href: string}}[], 所有可交互元素，尽量包含其DOM属性(id/name/href)',
                forms: '{{action: string, fields: {{name: string, type: string, placeholder: string}}[]}}[], 所有表单',
                sections: '{{name: string, description: string}}[], 页面主要区域/板块及其功能描述'
            }}, {{ domIncluded: true }});

            result.pages.push({{
                url: subPageInfo.url || fullUrl,
                title: subPageInfo.title,
                description: subPageInfo.description,
                elements: subPageInfo.interactive_elements,
                sections: subPageInfo.sections,
                forms: subPageInfo.forms,
                screenshot: path.basename(subShotPath),
                status: 'completed'
            }});

            sendProgress({{
                type: 'page_analyzed',
                url: subPageInfo.url || fullUrl,
                title: subPageInfo.title,
                elements_count: subPageInfo.interactive_elements?.length || 0,
                screenshot: path.basename(subShotPath)
            }});
        }} catch (e) {{
            result.pages.push({{
                url: link,
                title: '探索失败',
                error: e.message,
                status: 'failed'
            }});
        }}
    }}

    sendProgress({{ type: 'completed', total_pages: result.pages.length }});
}} catch (error) {{
    process.stdout.write(JSON.stringify({{ type: 'error', message: error.message }}) + '\\n');
}} finally {{
    await browser.close();
}}

// 输出最终结果
process.stdout.write(JSON.stringify({{ type: 'result', data: result }}) + '\\n');
"""

    async def _run_script(self, script_path: Path, callback=None) -> dict:
        """运行Node.js脚本"""
        cmd = ["node", str(script_path)]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        result_data = {"pages": [], "structure": None}

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

        return result_data
