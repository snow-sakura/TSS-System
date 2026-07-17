"""
TSS AI测试平台 — AI Agent 工厂
支持 CrewAI (开发期) 和 LangGraph (生产期) 渐进迁移
当前: CrewAI 优先，提供降级模拟模式
"""

import json
import time
from typing import Any, Optional
from datetime import datetime

from backend.app.core.config import settings
from backend.app.core.logging import get_logger

logger = get_logger("agents")

# 尝试导入CrewAI，失败则使用模拟模式
try:
    from crewai import Agent, Task, Crew, Process
    CREWAI_AVAILABLE = True
    logger.info("✅ CrewAI 加载成功")
except ImportError:
    CREWAI_AVAILABLE = False
    logger.warning("⚠️ CrewAI 未安装，使用模拟模式")


# ============================================================
# 工具函数
# ============================================================

class AgentTools:
    """Agent 可用的工具集"""

    @staticmethod
    def analyze_requirement_text(content: str) -> dict:
        """分析需求文本，提取关键信息"""
        # TODO: 接入 RAG / 向量检索
        return {
            "word_count": len(content),
            "has_technical_terms": any(t in content.lower()
                for t in ["api", "接口", "登录", "认证", "数据库", "响应"]),
        }

    @staticmethod
    def search_knowledge_base(query: str) -> list[dict]:
        """搜索知识库 (MCP工具)"""
        # TODO: 接入向量数据库
        return []

    @staticmethod
    def format_test_case(steps: list[dict]) -> list[dict]:
        """格式化测试步骤"""
        return [
            {"step": i + 1, "action": s.get("action", ""), "expected": s.get("expected", "")}
            for i, s in enumerate(steps)
        ]


# ============================================================
# Agent 定义
# ============================================================

class BaseAgent:
    """Agent 基类"""

    def __init__(self, name: str, role: str, goal: str, backstory: str):
        self.name = name
        self.role = role
        self.goal = goal
        self.backstory = backstory
        self._crew_agent = None

        if CREWAI_AVAILABLE:
            self._crew_agent = Agent(
                role=role,
                goal=goal,
                backstory=backstory,
                allow_delegation=False,
                verbose=settings.DEBUG,
            )

    def execute(self, task_description: str, expected_output: str = "", context: Optional[dict] = None) -> dict:
        """执行任务 — CrewAI 或 模拟模式"""
        start = time.time()

        if CREWAI_AVAILABLE and self._crew_agent:
            return self._execute_with_crewai(task_description, expected_output, context)
        else:
            return self._execute_simulated(task_description, expected_output, context)

    def _execute_with_crewai(self, task: str, expected_output: str, context: Optional[dict]) -> dict:
        """使用 CrewAI 执行"""
        crew_task = Task(
            description=task,
            agent=self._crew_agent,
            expected_output=expected_output or "结构化JSON输出",
        )
        crew = Crew(
            agents=[self._crew_agent],
            tasks=[crew_task],
            process=Process.sequential,
            verbose=settings.DEBUG,
        )
        result = crew.kickoff()
        return {
            "success": True,
            "output": str(result),
            "agent": self.name,
            "duration_ms": 0,
        }

    def _execute_simulated(self, task: str, expected_output: str, context: Optional[dict]) -> dict:
        """模拟模式 — 当CrewAI不可用时"""
        logger.info(f"[模拟Agent] {self.name}: {task[:80]}...")
        return {
            "success": True,
            "output": self._generate_mock_output(task, context),
            "agent": self.name,
            "simulated": True,
        }

    def _generate_mock_output(self, task: str, context: Optional[dict]) -> Any:
        """生成模拟输出"""
        task_lower = task.lower()

        if "需求分析" in task or "analyze requirement" in task_lower:
            return {
                "summary": "需求分析完成",
                "test_points_suggested": [
                    {"title": "功能正确性验证", "type": "functional", "priority": "high"},
                    {"title": "性能基准测试", "type": "performance", "priority": "medium"},
                ],
                "risks": ["需要确认边界条件"],
            }

        if "测试点" in task or "test point" in task_lower:
            return [
                {"title": "登录界面UI验证", "type": "ui", "priority": "high"},
                {"title": "用户名密码输入验证", "type": "functional", "priority": "high"},
                {"title": "登录状态保持验证", "type": "functional", "priority": "medium"},
            ]

        if "测试用例" in task or "test case" in task_lower:
            return [
                {
                    "title": "TC-001: 正常登录流程验证",
                    "precondition": "用户已注册且账户正常",
                    "steps": [
                        {"step": 1, "action": "打开登录页面", "expected": "页面正常加载"},
                        {"step": 2, "action": "输入正确用户名和密码", "expected": "输入正常"},
                        {"step": 3, "action": "点击登录按钮", "expected": "登录成功，跳转首页"},
                    ],
                    "priority": "p0",
                },
                {
                    "title": "TC-002: 密码错误登录验证",
                    "precondition": "用户已注册",
                    "steps": [
                        {"step": 1, "action": "打开登录页面", "expected": "页面正常加载"},
                        {"step": 2, "action": "输入错误密码", "expected": "输入正常"},
                        {"step": 3, "action": "点击登录按钮", "expected": "提示密码错误"},
                    ],
                    "priority": "p1",
                },
            ]

        if "缺陷分析" in task or "defect" in task_lower:
            return {
                "root_cause_analysis": "疑似空指针异常，建议检查输入参数",
                "suggestion": "增加参数非空校验",
                "severity_assessment": "major",
            }

        return {"result": "模拟执行完成", "task": task[:50]}


# ============================================================
# 预定义 Agent 实例
# ============================================================

requirement_analyzer = BaseAgent(
    name="需求分析师",
    role="需求分析专家",
    goal="从需求文档中提取关键信息，识别测试范围",
    backstory="拥有10年软件测试经验的专业需求分析师，擅长从文档中发现潜在问题。",
)

test_point_extractor = BaseAgent(
    name="测试点提取器",
    role="测试设计专家",
    goal="从需求中识别所有可测试的功能点和场景",
    backstory="精通各类测试设计方法，善于发现边界条件和异常场景。",
)

test_case_generator = BaseAgent(
    name="测试用例生成器",
    role="测试用例设计专家",
    goal="基于测试点生成高质量、覆盖全面的测试用例",
    backstory="拥有丰富的测试用例库，遵循ISO 29119标准。",
)

defect_analyzer = BaseAgent(
    name="缺陷分析专家",
    role="缺陷分析专家",
    goal="分析缺陷根因，提供修复建议和影响范围评估",
    backstory="资深Debug工程师，擅长代码级缺陷分析和性能问题诊断。",
)

test_report_generator = BaseAgent(
    name="测试报告生成器",
    role="测试报告专家",
    goal="汇总测试数据，生成专业的测试报告",
    backstory="精通质量度量体系，能生成符合CMMI标准的测试报告。",
)


# ============================================================
# Agent 编排服务
# ============================================================

class AgentOrchestrator:
    """Agent 编排器 — 协调多个Agent完成复杂任务"""

    def __init__(self):
        self.agents = {
            "requirement_analyzer": requirement_analyzer,
            "test_point_extractor": test_point_extractor,
            "test_case_generator": test_case_generator,
            "defect_analyzer": defect_analyzer,
            "test_report_generator": test_report_generator,
        }

    def run_sequential(self, pipeline: list[dict], context: Optional[dict] = None) -> list[dict]:
        """顺序执行多个Agent任务"""
        results = []
        for step in pipeline:
            agent_name = step.get("agent")
            task = step.get("task", "")
            agent = self.agents.get(agent_name)
            if not agent:
                logger.warning(f"未知Agent: {agent_name}")
                continue
            result = agent.execute(task, context=context)
            results.append(result)
            if context is None:
                context = {}
            context[step.get("output_key", "last_result")] = result.get("output")
        return results

    def analyze_requirement(self, title: str, content: str) -> dict:
        """完整的需求分析流水线"""
        pipeline = [
            {"agent": "requirement_analyzer", "task": f"分析需求: {title}", "output_key": "analysis"},
            {"agent": "test_point_extractor", "task": f"从需求提取测试点: {content[:200]}", "output_key": "test_points"},
        ]
        results = self.run_sequential(pipeline, {"title": title})
        return {
            "analysis": results[0].get("output") if len(results) > 0 else {},
            "test_points": results[1].get("output") if len(results) > 1 else [],
            "agent_results": results,
        }

    def generate_test_cases(self, test_points: list[str], count: int = 5) -> list[dict]:
        """基于测试点生成测试用例"""
        task = f"基于以下 {len(test_points)} 个测试点生成 {count} 条测试用例: {json.dumps(test_points, ensure_ascii=False)}"
        result = test_case_generator.execute(task)
        output = result.get("output", [])
        if isinstance(output, list):
            return output
        return []

    def analyze_defect(self, title: str, description: str) -> dict:
        """缺陷根因分析"""
        task = f"分析缺陷: {title}\n描述: {description[:300]}"
        result = defect_analyzer.execute(task)
        return result.get("output", {})


# 全局编排器实例
orchestrator = AgentOrchestrator()
