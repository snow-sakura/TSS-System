"""测试用例生成Agent"""

import json
from typing import Optional

from .base_agent import BaseAgent


class TestGeneratorAgent(BaseAgent):
    """AI测试用例生成Agent

    根据网页探索结果，自动生成结构化测试用例。
    """

    SYSTEM_PROMPT = """你是一个专业的软件测试工程师AI助手。
你的任务是根据网站探索结果，生成高质量的自动化测试用例。

测试用例格式要求：
1. 每个用例包含：标题、描述、前置条件、步骤、预期结果、优先级
2. 步骤使用midscene.js的API格式：
   - aiTap: 点击元素 (target: 自然语言描述)
   - aiInput: 输入文本 (target: 元素描述, value: 输入内容)
   - aiAssert: 断言验证 (target: 断言描述)
   - aiQuery: 数据提取 (dataDemand: 数据格式描述)
3. 优先级: P0(核心) > P1(重要) > P2(一般) > P3(低优先)
4. 覆盖正常流程和异常流程

请以JSON数组格式返回测试用例列表。"""

    def __init__(
        self,
        model_name: str = "gpt-4o",
        api_key: str = "",
        base_url: str = "https://api.openai.com/v1",
    ):
        super().__init__(name="test_generator", model_name=model_name, api_key=api_key, base_url=base_url)

    async def run(self, url: str = "", page_structure: dict = None, pages: list = None, **kwargs) -> list[dict]:
        """执行Agent任务 - 生成测试用例"""
        return await self.generate(url, page_structure or {}, pages or [])

    async def generate(
        self,
        url: str,
        page_structure: dict,
        pages: list[dict],
        additional_requirements: str = None,
    ) -> list[dict]:
        """生成测试用例

        Args:
            url: 目标URL
            page_structure: 主页面结构
            pages: 所有探索到的页面
            additional_requirements: 额外需求

        Returns:
            测试用例列表
        """
        self.logger.info(f"开始生成测试用例: {url}")

        # 确保page_structure是字典
        if not isinstance(page_structure, dict):
            page_structure = {}

        # 确保pages是字典列表
        pages_list = []
        for p in pages:
            if isinstance(p, dict):
                pages_list.append(p)
            else:
                pages_list.append({"url": str(p), "title": ""})

        prompt = f"""请根据以下网站探索结果生成测试用例。

目标网站: {url}

主页面结构:
{json.dumps(page_structure, ensure_ascii=False, indent=2)}

探索到的页面 ({len(pages_list)}个):
{json.dumps([{'url': p.get('url', ''), 'title': p.get('title', '')} for p in pages_list], ensure_ascii=False, indent=2)}
"""

        if additional_requirements:
            prompt += f"\n额外需求: {additional_requirements}"

        prompt += """

请返回JSON数组格式的测试用例列表，每个用例包含：
{
    "title": "测试用例标题",
    "description": "用例描述",
    "preconditions": "前置条件",
    "steps": [
        {"action": "aiTap", "target": "元素描述"},
        {"action": "aiInput", "target": "输入框描述", "value": "输入内容"},
        {"action": "aiAssert", "target": "断言描述"}
    ],
    "expected_result": "预期结果",
    "priority": "P1",
    "page_url": "相关页面URL"
}

要求覆盖：
1. 导航和链接跳转
2. 表单填写和提交
3. 搜索功能
4. 核心业务流程
5. 错误场景（必填字段为空等）"""

        response = await self.call_llm(prompt, self.SYSTEM_PROMPT)
        self.logger.info(f"LLM生成响应: {len(response)} 字符")

        # 解析JSON
        try:
            # 尝试提取JSON部分
            start = response.find("[")
            end = response.rfind("]") + 1
            if start >= 0 and end > start:
                test_cases = json.loads(response[start:end])
            else:
                test_cases = json.loads(response)
        except json.JSONDecodeError:
            self.logger.error(f"JSON解析失败: {response[:500]}")
            # 返回一个基本的测试用例
            test_cases = [{
                "title": f"首页基本功能验证 - {url}",
                "description": "验证首页是否正常加载和基本交互",
                "preconditions": "浏览器已打开",
                "steps": [
                    {"action": "aiAssert", "target": "页面已加载，显示正常内容"},
                ],
                "expected_result": "页面正常显示",
                "priority": "P0",
                "page_url": url,
            }]

        self.logger.info(f"生成 {len(test_cases)} 条测试用例")
        return test_cases
