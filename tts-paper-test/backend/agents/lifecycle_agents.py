"""测试生命周期 AI Agent - 覆盖7个阶段"""
import json
from typing import Optional, Callable, Awaitable
from .base_agent import BaseAgent


class RequirementAnalysisAgent(BaseAgent):
    """需求分析Agent"""

    SYSTEM_PROMPT = """你是一个专业的软件需求分析AI助手。
你的任务是根据用户提供的需求文档或描述，分析并结构化需求信息。
输出格式：
{
    "summary": "需求概述",
    "functional_points": [{"name": "功能点名称", "description": "描述", "priority": "P0/P1/P2"}],
    "business_rules": [{"rule": "业务规则", "detail": "详细说明"}],
    "suggestions": ["建议1", "建议2"]
}"""

    async def analyze(self, description: str, existing_requirements: list[dict] = None) -> dict:
        self.logger.info("开始需求分析")
        prompt = f"请分析以下需求描述：\n\n{description}"
        if existing_requirements:
            prompt += f"\n\n已有需求：{json.dumps(existing_requirements, ensure_ascii=False)}"
        response = await self.call_llm(prompt, self.SYSTEM_PROMPT)
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            return json.loads(response[start:end]) if start >= 0 else {"summary": response}
        except json.JSONDecodeError:
            return {"summary": response}

    async def run(self, *args, **kwargs):
        return await self.analyze(*args, **kwargs)


class TestPlanAgent(BaseAgent):
    """测试方案Agent"""

    SYSTEM_PROMPT = """你是一个专业的测试策略AI助手。
根据需求分析结果，制定测试方案和策略。
输出JSON格式：
{
    "strategy": "测试策略概述",
    "test_scope": ["测试范围1", "测试范围2"],
    "test_types": ["功能测试", "性能测试", ...],
    "risk_analysis": [{"risk": "风险", "level": "高/中/低", "mitigation": "缓解措施"}],
    "resource_estimate": "资源估算",
    "schedule_suggestion": "进度建议"
}"""

    async def generate_plan(self, requirements: list[dict], scope: str = None) -> dict:
        self.logger.info("开始制定测试方案")
        prompt = f"根据以下需求制定测试方案：\n\n{json.dumps(requirements, ensure_ascii=False, indent=2)}"
        if scope:
            prompt += f"\n\n测试范围：{scope}"
        response = await self.call_llm(prompt, self.SYSTEM_PROMPT)
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            return json.loads(response[start:end]) if start >= 0 else {"strategy": response}
        except json.JSONDecodeError:
            return {"strategy": response}

    async def run(self, *args, **kwargs):
        return await self.generate_plan(*args, **kwargs)


class TestPointExtractAgent(BaseAgent):
    """测试点提取Agent"""

    SYSTEM_PROMPT = """你是一个测试点分析AI助手。
根据需求分析和测试方案，提取详细的测试点。
输出JSON数组：
[
    {"name": "测试点名称", "category": "功能/UI/性能/安全", "priority": "P0/P1/P2", "description": "详细描述"}
]"""

    async def extract(self, requirements: list[dict], plan: dict = None) -> list[dict]:
        self.logger.info("开始提取测试点")
        prompt = f"根据以下需求和方案提取测试点：\n\n需求：{json.dumps(requirements, ensure_ascii=False, indent=2)}"
        if plan:
            prompt += f"\n\n方案：{json.dumps(plan, ensure_ascii=False, indent=2)}"

        prompt += "\n\n请返回JSON数组格式的测试点列表。"
        response = await self.call_llm(prompt, self.SYSTEM_PROMPT)
        try:
            start = response.find("[")
            end = response.rfind("]") + 1
            return json.loads(response[start:end]) if start >= 0 else []
        except json.JSONDecodeError:
            return [{"name": "基础功能验证", "category": "功能", "priority": "P0"}]

    async def run(self, *args, **kwargs):
        return await self.extract(*args, **kwargs)


class TestCaseGenerateAgent(BaseAgent):
    """测试用例生成Agent"""

    SYSTEM_PROMPT = """你是一个测试用例设计AI助手。
根据测试点生成详细的测试用例。
输出JSON数组：
[
    {
        "name": "TC-用例名称",
        "description": "用例描述",
        "preconditions": "前置条件",
        "steps": [{"action": "操作", "data": "数据", "expected": "预期"}],
        "expected_result": "预期结果",
        "priority": "P0/P1/P2",
        "test_type": "功能测试"
    }
]"""

    async def generate(self, test_points: list[dict], count: int = 10) -> list[dict]:
        self.logger.info(f"开始生成测试用例，基于{len(test_points)}个测试点")
        prompt = f"根据以下测试点生成测试用例（生成约{count}条）：\n\n{json.dumps(test_points, ensure_ascii=False, indent=2)}"
        response = await self.call_llm(prompt, self.SYSTEM_PROMPT)
        try:
            start = response.find("[")
            end = response.rfind("]") + 1
            return json.loads(response[start:end]) if start >= 0 else []
        except json.JSONDecodeError:
            return [{"name": "基础功能验证", "description": "验证基本功能", "steps": [], "priority": "P0"}]

    async def run(self, *args, **kwargs):
        return await self.generate(*args, **kwargs)


class DefectAnalysisAgent(BaseAgent):
    """缺陷分析Agent"""

    SYSTEM_PROMPT = """你是一个缺陷分析AI助手。
分析缺陷描述，推断根因并提供修复建议。
输出JSON：
{
    "root_cause": "根因分析",
    "impact_scope": "影响范围",
    "suggested_fix": "修复建议",
    "preventive_measures": ["预防措施1", "预防措施2"],
    "similar_patterns": ["相似模式"]
}"""

    async def analyze(self, defect: dict) -> dict:
        self.logger.info(f"开始分析缺陷: {defect.get('title', 'unknown')}")
        prompt = f"分析以下缺陷：\n\n{json.dumps(defect, ensure_ascii=False, indent=2)}"
        response = await self.call_llm(prompt, self.SYSTEM_PROMPT)
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            return json.loads(response[start:end]) if start >= 0 else {"root_cause": response}
        except json.JSONDecodeError:
            return {"root_cause": response}

    async def run(self, *args, **kwargs):
        return await self.analyze(*args, **kwargs)


class ReportGenerateAgent(BaseAgent):
    """报告生成Agent"""

    SYSTEM_PROMPT = """你是一个测试报告生成AI助手。
汇总测试数据，生成结构化的测试报告。
输出JSON：
{
    "executive_summary": "执行摘要",
    "key_metrics": {"total_cases": 0, "passed": 0, "failed": 0, "pass_rate": 0},
    "defect_summary": {"total": 0, "critical": 0, "major": 0, "minor": 0},
    "quality_assessment": "质量评估",
    "risks": [{"risk": "风险", "level": "高/中/低"}],
    "recommendations": ["建议1", "建议2"],
    "conclusion": "结论"
}"""

    async def generate(self, execution_data: dict, defect_data: dict, requirements: list[dict] = None) -> dict:
        self.logger.info("开始生成测试报告")
        prompt = f"""请根据以下数据生成测试报告：

执行数据：
{json.dumps(execution_data, ensure_ascii=False, indent=2)}

缺陷数据：
{json.dumps(defect_data, ensure_ascii=False, indent=2)}"""

        if requirements:
            prompt += f"\n\n需求数据：{json.dumps(requirements, ensure_ascii=False, indent=2)}"

        response = await self.call_llm(prompt, self.SYSTEM_PROMPT)
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            return json.loads(response[start:end]) if start >= 0 else {"executive_summary": response}
        except json.JSONDecodeError:
            return {"executive_summary": response}

    async def run(self, *args, **kwargs):
        return await self.generate(*args, **kwargs)
