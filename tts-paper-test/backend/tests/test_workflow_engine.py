"""
工作流引擎测试
- DAG 拓扑排序 (Kahn 算法)
- 节点执行 (start/end/delay/condition/script)
- 完整工作流执行
- 环检测
"""
import pytest
from collections import defaultdict, deque
from sqlalchemy.ext.asyncio import AsyncSession

from models.workflow import Workflow, WorkflowNode, WorkflowEdge
from services.workflow_engine import WorkflowEngine, WorkflowEngineError


class TestTopologicalSort:
    """Kahn 算法拓扑排序"""

    def test_linear_dag(self):
        """线性 DAG: 1 → 2 → 3"""
        engine = WorkflowEngine(db=None)  # type: ignore
        graph = defaultdict(list, {1: [2], 2: [3]})
        in_degree = {1: 0, 2: 1, 3: 1}
        order = engine._topological_sort(graph, in_degree)
        assert order == [1, 2, 3]

    def test_diamond_dag(self):
        """菱形 DAG: 1 → (2,3) → 4"""
        engine = WorkflowEngine(db=None)  # type: ignore
        graph = defaultdict(list, {1: [2, 3], 2: [4], 3: [4]})
        in_degree = {1: 0, 2: 1, 3: 1, 4: 2}
        order = engine._topological_sort(graph, in_degree)
        assert order[0] == 1
        assert order[-1] == 4
        assert set(order[1:3]) == {2, 3}

    def test_parallel_nodes(self):
        """并行节点: 1 → (2, 3, 4) → 5"""
        engine = WorkflowEngine(db=None)  # type: ignore
        graph = defaultdict(list, {1: [2, 3, 4], 2: [5], 3: [5], 4: [5]})
        in_degree = {1: 0, 2: 1, 3: 1, 4: 1, 5: 3}
        order = engine._topological_sort(graph, in_degree)
        assert order[0] == 1
        assert order[-1] == 5
        assert len(order) == 5

    def test_single_node(self):
        """单节点"""
        engine = WorkflowEngine(db=None)  # type: ignore
        graph = defaultdict(list)
        in_degree = {1: 0}
        order = engine._topological_sort(graph, in_degree)
        assert order == [1]

    def test_disconnected_nodes(self):
        """不连通图"""
        engine = WorkflowEngine(db=None)  # type: ignore
        graph = defaultdict(list, {1: [2], 3: [4]})
        in_degree = {1: 0, 2: 1, 3: 0, 4: 1}
        order = engine._topological_sort(graph, in_degree)
        assert len(order) == 4
        assert order.index(1) < order.index(2)
        assert order.index(3) < order.index(4)

    def test_cycle_detection(self):
        """环检测 — 应抛出异常"""
        engine = WorkflowEngine(db=None)  # type: ignore
        graph = defaultdict(list, {1: [2], 2: [3], 3: [1]})
        in_degree = {1: 1, 2: 1, 3: 1}
        with pytest.raises(WorkflowEngineError, match="存在环"):
            engine._topological_sort(graph, in_degree)

    def test_self_loop(self):
        """自环"""
        engine = WorkflowEngine(db=None)  # type: ignore
        graph = defaultdict(list, {1: [1]})
        in_degree = {1: 0}
        with pytest.raises(WorkflowEngineError, match="存在环"):
            engine._topological_sort(graph, in_degree)

    def test_complex_dag(self):
        """复杂 DAG"""
        engine = WorkflowEngine(db=None)  # type: ignore
        graph = defaultdict(list, {
            1: [2, 3],
            2: [4],
            3: [5],
            4: [6],
            5: [6],
            6: [],
        })
        in_degree = {1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2}
        order = engine._topological_sort(graph, in_degree)
        assert len(order) == 6
        assert order[0] == 1
        assert order[-1] == 6


class TestNodeExecutors:
    """各类节点执行器"""

    @pytest.mark.asyncio
    async def test_start_node(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="start", config={"params": {"url": "https://test.com"}})
        result = await engine._execute_start(node, {})
        assert result["started"] is True
        assert result["params"]["url"] == "https://test.com"

    @pytest.mark.asyncio
    async def test_end_node(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="end")
        inputs = {"test_key": "test_value"}
        result = await engine._execute_end(node, inputs)
        assert result["finished"] is True
        assert result["summary"]["test_key"] == "test_value"

    @pytest.mark.asyncio
    async def test_delay_node(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="delay", config={"seconds": 0.01})
        import time
        start = time.time()
        result = await engine._execute_delay(node, {})
        elapsed = time.time() - start
        assert result["delayed"] is True
        assert result["seconds"] == 0.01
        assert elapsed >= 0.01

    @pytest.mark.asyncio
    async def test_condition_true(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="condition", config={"expression": "true"})
        result = await engine._execute_condition(node, {})
        assert result["condition_result"] is True

    @pytest.mark.asyncio
    async def test_condition_false(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="condition", config={"expression": "false"})
        result = await engine._execute_condition(node, {})
        assert result["condition_result"] is False

    @pytest.mark.asyncio
    async def test_condition_invalid(self):
        """非法表达式视为 false"""
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="condition", config={"expression": "x > 5"})
        result = await engine._execute_condition(node, {})
        assert result["condition_result"] is False

    @pytest.mark.asyncio
    async def test_script_node(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="script", config={"language": "python"})
        result = await engine._execute_script(node, {})
        assert result["executed"] is True

    @pytest.mark.asyncio
    async def test_mcp_tool_node(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="mcp_tool", config={"tool_name": "read_file"})
        result = await engine._execute_mcp_tool(node, {})
        assert result["called"] is True
        assert result["tool"] == "read_file"

    @pytest.mark.asyncio
    async def test_knowledge_query_node(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="knowledge_query", config={"query_template": "test", "limit": 10})
        result = await engine._execute_knowledge_query(node, {})
        assert result["query"] == "test"
        assert result["count"] == 0

    @pytest.mark.asyncio
    async def test_llm_chat_node(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="llm_chat", config={"prompt_template": "Hello"})
        result = await engine._execute_llm_chat(node, {})
        assert result["prompt"] == "Hello"
        assert "(mock)" in result["response"]

    @pytest.mark.asyncio
    async def test_unsupported_node_type(self):
        engine = WorkflowEngine(db=None)  # type: ignore
        node = WorkflowNode(type="unsupported_type")
        with pytest.raises(WorkflowEngineError, match="不支持的节点类型"):
            await engine._execute_single_node(node, {}, None)  # type: ignore


class TestWorkflowExecution:
    """完整工作流执行"""

    @pytest.mark.asyncio
    async def test_simple_linear_workflow(self, db_session: AsyncSession):
        """start → delay → end"""
        wf = Workflow(name="Test Simple", status="active")
        db_session.add(wf)
        await db_session.flush()

        n1 = WorkflowNode(workflow_id=wf.id, type="start", label="开始", config={"params": {"from": "test"}})
        n2 = WorkflowNode(workflow_id=wf.id, type="delay", label="等待", config={"seconds": 0.01})
        n3 = WorkflowNode(workflow_id=wf.id, type="end", label="结束")
        db_session.add_all([n1, n2, n3])
        await db_session.flush()

        db_session.add(WorkflowEdge(workflow_id=wf.id, source_node_id=n1.id, target_node_id=n2.id))
        db_session.add(WorkflowEdge(workflow_id=wf.id, source_node_id=n2.id, target_node_id=n3.id))
        await db_session.commit()

        engine = WorkflowEngine(db=db_session)
        execution = await engine.execute_workflow(wf.id, trigger="manual")

        assert execution.status == "completed"
        assert execution.trigger == "manual"
        assert execution.started_at is not None
        assert execution.finished_at is not None

        # 验证节点执行记录
        node_execs = execution.node_executions
        assert len(node_execs) == 3
        statuses = {ne.node_type: ne.status for ne in node_execs}
        assert statuses["start"] == "completed"
        assert statuses["delay"] == "completed"
        assert statuses["end"] == "completed"

    @pytest.mark.asyncio
    async def test_parallel_workflow(self, db_session: AsyncSession):
        """start → (delay_1, delay_2) → end"""
        wf = Workflow(name="Test Parallel", status="active")
        db_session.add(wf)
        await db_session.flush()

        n1 = WorkflowNode(workflow_id=wf.id, type="start", label="开始")
        n2 = WorkflowNode(workflow_id=wf.id, type="delay", label="并行A", config={"seconds": 0.02})
        n3 = WorkflowNode(workflow_id=wf.id, type="delay", label="并行B", config={"seconds": 0.01})
        n4 = WorkflowNode(workflow_id=wf.id, type="end", label="结束")
        db_session.add_all([n1, n2, n3, n4])
        await db_session.flush()

        db_session.add(WorkflowEdge(workflow_id=wf.id, source_node_id=n1.id, target_node_id=n2.id))
        db_session.add(WorkflowEdge(workflow_id=wf.id, source_node_id=n1.id, target_node_id=n3.id))
        db_session.add(WorkflowEdge(workflow_id=wf.id, source_node_id=n2.id, target_node_id=n4.id))
        db_session.add(WorkflowEdge(workflow_id=wf.id, source_node_id=n3.id, target_node_id=n4.id))
        await db_session.commit()

        engine = WorkflowEngine(db=db_session)
        execution = await engine.execute_workflow(wf.id)

        assert execution.status == "completed"
        node_execs = execution.node_executions
        assert len(node_execs) == 4
        for ne in node_execs:
            assert ne.status == "completed"

    @pytest.mark.asyncio
    async def test_empty_workflow(self, db_session: AsyncSession):
        """没有节点的工作流"""
        wf = Workflow(name="Empty", status="active")
        db_session.add(wf)
        await db_session.commit()

        engine = WorkflowEngine(db=db_session)
        with pytest.raises(WorkflowEngineError, match="没有节点或连线"):
            await engine.execute_workflow(wf.id)

    @pytest.mark.asyncio
    async def test_workflow_not_found(self, db_session: AsyncSession):
        engine = WorkflowEngine(db=db_session)
        with pytest.raises(WorkflowEngineError, match="工作流不存在"):
            await engine.execute_workflow(99999)

    @pytest.mark.asyncio
    async def test_workflow_with_condition(self, db_session: AsyncSession):
        """start → condition → end (condition=true 应正常完成)"""
        wf = Workflow(name="Test Condition", status="active")
        db_session.add(wf)
        await db_session.flush()

        n1 = WorkflowNode(workflow_id=wf.id, type="start", label="开始")
        n2 = WorkflowNode(workflow_id=wf.id, type="condition", label="条件判断",
                          config={"expression": "true"})
        n3 = WorkflowNode(workflow_id=wf.id, type="end", label="结束")
        db_session.add_all([n1, n2, n3])
        await db_session.flush()

        db_session.add(WorkflowEdge(workflow_id=wf.id, source_node_id=n1.id, target_node_id=n2.id))
        db_session.add(WorkflowEdge(workflow_id=wf.id, source_node_id=n2.id, target_node_id=n3.id))
        await db_session.commit()

        engine = WorkflowEngine(db=db_session)
        execution = await engine.execute_workflow(wf.id)

        assert execution.status == "completed"
        for ne in execution.node_executions:
            assert ne.status == "completed"
