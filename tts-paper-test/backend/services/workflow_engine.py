"""
工作流执行引擎 — DAG 拓扑排序 + 节点执行器

支持节点类型:
  - start / end: 开始/结束
  - engine_task: 调用 AI 引擎 (Midscene/PlaywrightMCP/Mock)
  - mcp_tool: 调用已安装的 MCP 服务工具
  - knowledge_query: 查询知识库
  - llm_chat: LLM 对话
  - condition: 条件分支
  - delay: 延时等待
  - script: 自定义脚本
  - web_automation: AI Web 自动化（探索/生成用例/执行测试）
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from collections import defaultdict, deque

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.workflow import (
    Workflow,
    WorkflowNode,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowNodeExecution,
)

logger = logging.getLogger(__name__)


class WorkflowEngineError(Exception):
    """工作流引擎异常"""


class NodeExecutionContext:
    """单次节点执行的上下文"""

    def __init__(self, node: WorkflowNode, inputs: dict[str, Any]):
        self.node = node
        self.inputs = inputs
        self.outputs: dict[str, Any] = {}
        self.error: Optional[str] = None
        self.status = "pending"


class WorkflowEngine:
    """DAG 工作流执行引擎"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._node_executors: dict[str, callable] = {
            "start": self._execute_start,
            "end": self._execute_end,
            "engine_task": self._execute_engine_task,
            "mcp_tool": self._execute_mcp_tool,
            "knowledge_query": self._execute_knowledge_query,
            "llm_chat": self._execute_llm_chat,
            "condition": self._execute_condition,
            "delay": self._execute_delay,
            "script": self._execute_script,
            "web_automation": self._execute_web_automation,
        }

    # ----------------------------------------------------------------
    # 公开 API
    # ----------------------------------------------------------------

    async def execute_workflow(self, workflow_id: int, trigger: str = "manual") -> WorkflowExecution:
        """执行整个工作流"""
        workflow = await self._load_workflow(workflow_id)
        if not workflow.nodes or not workflow.edges:
            raise WorkflowEngineError("工作流没有节点或连线")

        nodes = {n.id: n for n in workflow.nodes}
        edges = workflow.edges

        # 构建邻接表
        graph: dict[int, list[int]] = defaultdict(list)
        in_degree: dict[int, int] = defaultdict(int)
        for n in nodes:
            in_degree[n] = 0
        for e in edges:
            graph[e.source_node_id].append(e.target_node_id)
            in_degree[e.target_node_id] += 1

        # 拓扑排序
        topo_order = self._topological_sort(graph, in_degree)

        # 创建执行记录
        execution = WorkflowExecution(
            workflow_id=workflow_id,
            status="running",
            started_at=datetime.now(timezone.utc),
            trigger=trigger,
        )
        self.db.add(execution)
        await self.db.flush()

        # 创建节点执行记录
        node_execs: dict[int, WorkflowNodeExecution] = {}
        for nid in topo_order:
            node = nodes[nid]
            ne = WorkflowNodeExecution(
                execution_id=execution.id,
                node_id=nid,
                node_type=node.type,
                node_label=node.label or node.type,
                status="pending",
            )
            self.db.add(ne)
            node_execs[nid] = ne
        await self.db.commit()

        try:
            await self._execute_nodes(
                execution=execution,
                nodes=nodes,
                edges=edges,
                topo_order=topo_order,
                node_execs=node_execs,
                graph=graph,
                in_degree=in_degree,
            )
            execution.status = "completed"
        except WorkflowEngineError as e:
            execution.status = "failed"
            execution.error = str(e)
        except Exception as e:
            execution.status = "failed"
            execution.error = f"未知错误: {e}"
            logger.exception("工作流执行异常")

        execution.finished_at = datetime.now(timezone.utc)
        await self.db.commit()
        return execution

    # ----------------------------------------------------------------
    # 内部执行逻辑
    # ----------------------------------------------------------------

    async def _execute_nodes(
        self,
        execution: WorkflowExecution,
        nodes: dict[int, WorkflowNode],
        edges: list[WorkflowEdge],
        topo_order: list[int],
        node_execs: dict[int, WorkflowNodeExecution],
        graph: dict[int, list[int]],
        in_degree: dict[int, int],
    ):
        """按拓扑序执行节点，支持并行执行"""
        # 节点入度（用于判断前置是否全部完成）
        remaining_in = dict(in_degree)
        # 节点输出（传递给下游）
        node_outputs: dict[int, dict[str, Any]] = {}
        # 已入队
        queued = set()

        ready_queue: deque[int] = deque()
        # 初始 ready 节点：入度为 0 的
        for nid in topo_order:
            if remaining_in.get(nid, 0) == 0:
                ready_queue.append(nid)
                queued.add(nid)

        running_tasks: dict[int, asyncio.Task] = {}

        while ready_queue or running_tasks:
            # 启动所有 ready 节点
            while ready_queue:
                nid = ready_queue.popleft()
                node = nodes[nid]
                inputs = {}
                # 收集前置节点的输出
                for e in edges:
                    if e.target_node_id == nid:
                        if e.source_node_id in node_outputs:
                            inputs[e.label or f"input_{e.source_node_id}"] = node_outputs[e.source_node_id]

                task = asyncio.create_task(
                    self._execute_single_node(node, inputs, node_execs[nid])
                )
                running_tasks[nid] = task

            # 等待任一完成
            if running_tasks:
                done_set, _ = await asyncio.wait(running_tasks.values(), return_when=asyncio.FIRST_COMPLETED)
                for task in done_set:
                    # 找到对应的 node_id
                    finished_nid = None
                    for nid, t in running_tasks.items():
                        if t is task:
                            finished_nid = nid
                            break
                    if finished_nid is None:
                        continue

                    del running_tasks[finished_nid]
                    result = task.result()
                    node_outputs[finished_nid] = result

                    # 更新下游入度，入度归零则入队
                    for downstream in graph.get(finished_nid, []):
                        remaining_in[downstream] -= 1
                        if remaining_in[downstream] == 0 and downstream not in queued:
                            ready_queue.append(downstream)
                            queued.add(downstream)

        # 检查是否有未执行的节点（死锁检测）
        for nid in topo_order:
            if node_execs[nid].status == "pending":
                node_execs[nid].status = "skipped"
                node_execs[nid].error = "上游节点失败或未执行"

    async def _execute_single_node(
        self,
        node: WorkflowNode,
        inputs: dict[str, Any],
        node_exec: WorkflowNodeExecution,
    ) -> dict[str, Any]:
        """执行单个节点"""
        node_exec.status = "running"
        node_exec.started_at = datetime.now(timezone.utc)
        node_exec.input_data = inputs
        await self.db.flush()

        try:
            executor = self._node_executors.get(node.type)
            if not executor:
                raise WorkflowEngineError(f"不支持的节点类型: {node.type}")

            outputs = await executor(node, inputs)
            node_exec.status = "completed"
            node_exec.output_data = outputs
            return outputs

        except WorkflowEngineError as e:
            node_exec.status = "failed"
            node_exec.error = str(e)
            raise
        except Exception as e:
            node_exec.status = "failed"
            node_exec.error = f"执行异常: {e}"
            raise WorkflowEngineError(str(e)) from e
        finally:
            node_exec.finished_at = datetime.now(timezone.utc)
            await self.db.flush()

    # ----------------------------------------------------------------
    # 节点执行器
    # ----------------------------------------------------------------

    async def _execute_start(self, node: WorkflowNode, inputs: dict) -> dict:
        """开始节点 — 透传参数"""
        config = node.config or {}
        return {"started": True, "params": config.get("params", {})}

    async def _execute_end(self, node: WorkflowNode, inputs: dict) -> dict:
        """结束节点 — 汇总结果"""
        return {"finished": True, "summary": inputs}

    async def _execute_engine_task(self, node: WorkflowNode, inputs: dict) -> dict:
        """AI 引擎任务 — 调用 engine_registry 执行"""
        config = node.config or {}
        engine_type = config.get("engine_type", "mock")
        url = config.get("url", "")
        instruction = config.get("instruction", "")

        # 这里调用现有的 execution_engine
        from services.execution_engine import ExecutionEngine
        engine = ExecutionEngine(self.db)
        result = await engine.execute_explore(
            url=url,
            instruction=instruction or "浏览页面",
            engine_type=engine_type,
        )
        if hasattr(result, "dict"):
            return result.dict()
        return {"result": str(result)}

    async def _execute_mcp_tool(self, node: WorkflowNode, inputs: dict) -> dict:
        """MCP 工具调用 — 通过已安装的 MCP 服务"""
        config = node.config or {}
        # 预留：通过 MCPService 模型查询服务配置并调用
        logger.info("MCP 工具调用: %s", config)
        return {"called": True, "tool": config.get("tool_name"), "result": "(mock)"}

    async def _execute_knowledge_query(self, node: WorkflowNode, inputs: dict) -> dict:
        """知识库查询"""
        config = node.config or {}
        query = config.get("query_template", "")
        limit = config.get("limit", 5)
        logger.info("知识库查询: %s (limit=%s)", query, limit)
        return {"query": query, "results": [], "count": 0}

    async def _execute_llm_chat(self, node: WorkflowNode, inputs: dict) -> dict:
        """LLM 对话"""
        config = node.config or {}
        prompt = config.get("prompt_template", "")
        logger.info("LLM 对话: %s", prompt[:100])
        return {"prompt": prompt, "response": "(mock)"}

    async def _execute_condition(self, node: WorkflowNode, inputs: dict) -> dict:
        """条件分支 — 根据表达式返回 boolean"""
        config = node.config or {}
        expression = config.get("expression", "true")
        # 简单的条件判断（扩展可用 eval 沙箱）
        result = expression.strip().lower() == "true"
        return {"condition_result": result, "expression": expression}

    async def _execute_delay(self, node: WorkflowNode, inputs: dict) -> dict:
        """延时等待"""
        config = node.config or {}
        seconds = config.get("seconds", 1)
        await asyncio.sleep(seconds)
        return {"delayed": True, "seconds": seconds}

    async def _execute_script(self, node: WorkflowNode, inputs: dict) -> dict:
        """自定义脚本（预留）"""
        config = node.config or {}
        logger.info("自定义脚本执行: %s", config.get("language", "python"))
        return {"executed": True, "language": config.get("language")}

    async def _execute_web_automation(self, node: WorkflowNode, inputs: dict) -> dict:
        """
        AI Web 自动化节点 — 调用 Web 自动化 Agent
        config.action: explore / generate / execute / list_pages
        config.project_id: 目标项目ID（explore/generate/execute 必填）
        """
        from services import web_automation_service as was
        from config import get_settings

        config = node.config or {}
        action = config.get("action", "explore")
        project_id = config.get("project_id")

        logger.info("Web 自动化节点: action=%s, project_id=%s", action, project_id)

        if action == "explore":
            if not project_id:
                raise WorkflowEngineError("explore 操作需要 project_id")
            project = await was.get_project(self.db, int(project_id))
            settings = get_settings()

            from agents.web_explorer import WebExplorerAgent
            agent = WebExplorerAgent(
                model_name=settings.MIDSCENE_MODEL_NAME,
                api_key=settings.MIDSCENE_MODEL_API_KEY,
                base_url=settings.MIDSCENE_MODEL_BASE_URL,
                model_family=settings.MIDSCENE_MODEL_FAMILY,
            )

            await was.update_project_status(self.db, int(project_id), "exploring")
            result = await agent.explore(project.target_url)
            pages = result.get("pages", []) if isinstance(result, dict) else []

            # 保存探索到的页面
            for page_data in pages:
                await was.create_page(self.db, int(project_id), page_data)
            await was.update_project_status(self.db, int(project_id), "explored")

            return {
                "action": "explore",
                "project_id": project_id,
                "pages_found": len(pages),
                "pages": [{"url": p.get("url", ""), "title": p.get("title", "")} for p in pages],
            }

        elif action == "generate":
            if not project_id:
                raise WorkflowEngineError("generate 操作需要 project_id")
            settings = get_settings()

            pages = await was.list_pages(self.db, int(project_id))
            if not pages:
                raise WorkflowEngineError("请先执行AI探索，获取页面结构后再生成测试用例")

            from agents.test_generator import TestGeneratorAgent
            agent = TestGeneratorAgent(
                model_name=settings.DEFAULT_LLM_MODEL,
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
            )

            project = await was.get_project(self.db, int(project_id))
            page_structure = pages[0].page_map if pages and pages[0].page_map else {}
            pages_data = [{"url": p.url, "title": p.title} for p in pages]

            test_cases = await agent.generate(
                url=project.target_url,
                page_structure=page_structure,
                pages=pages_data,
            )

            created = await was.create_test_cases_from_ai(
                self.db, int(project_id), test_cases, agent.model_name
            )

            return {
                "action": "generate",
                "project_id": project_id,
                "cases_generated": len(created),
            }

        elif action == "execute":
            if not project_id:
                raise WorkflowEngineError("execute 操作需要 project_id")
            from sqlalchemy import select as sa_select
            from models.web_automation import WebTestCase

            result = await self.db.execute(
                sa_select(WebTestCase)
                .where(WebTestCase.project_id == int(project_id), WebTestCase.status == "approved")
                .order_by(WebTestCase.id)
            )
            approved_cases = result.scalars().all()

            if not approved_cases:
                raise WorkflowEngineError("没有已审批的测试用例，请先审批用例")

            case_ids = [c.id for c in approved_cases]
            execution = await was.create_execution(self.db, int(project_id), case_ids)

            return {
                "action": "execute",
                "project_id": project_id,
                "execution_id": execution.id,
                "cases_count": len(case_ids),
            }

        elif action == "list_pages":
            if not project_id:
                raise WorkflowEngineError("list_pages 操作需要 project_id")
            pages = await was.list_pages(self.db, int(project_id))
            return {
                "action": "list_pages",
                "project_id": project_id,
                "pages": [{"id": p.id, "url": p.url, "title": p.title} for p in pages],
                "count": len(pages),
            }

        else:
            raise WorkflowEngineError(f"不支持的 web_automation 操作: {action}")

    # ----------------------------------------------------------------
    # 辅助方法
    # ----------------------------------------------------------------

    async def _load_workflow(self, workflow_id: int) -> Workflow:
        """加载工作流（含节点和边）"""
        result = await self.db.execute(
            select(Workflow)
            .where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            raise WorkflowEngineError(f"工作流不存在: {workflow_id}")
        return workflow

    def _topological_sort(
        self,
        graph: dict[int, list[int]],
        in_degree: dict[int, int],
    ) -> list[int]:
        """Kahn 算法拓扑排序"""
        q = deque([n for n, d in in_degree.items() if d == 0])
        order = []
        temp_in = dict(in_degree)
        while q:
            n = q.popleft()
            order.append(n)
            for neighbor in graph.get(n, []):
                temp_in[neighbor] -= 1
                if temp_in[neighbor] == 0:
                    q.append(neighbor)
        if len(order) != len(in_degree):
            raise WorkflowEngineError("工作流存在环，无法执行")
        return order
