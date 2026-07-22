"""工作流编排模型 — DAG 节点/边/执行记录"""

from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, func, Column, Integer, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from .base import TimestampMixin


class Workflow(Base, TimestampMixin):
    """工作流定义"""
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)  # draft / active / archived
    tags: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    nodes = relationship("WorkflowNode", back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowNode.id")
    edges = relationship("WorkflowEdge", back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowEdge.id")


class WorkflowNode(Base, TimestampMixin):
    """工作流节点"""
    __tablename__ = "workflow_nodes"

    NODE_TYPES = (
        "start",           # 开始节点
        "end",             # 结束节点
        "engine_task",     # AI 引擎任务（Midscene/PlaywrightMCP/Mock）
        "mcp_tool",        # MCP 工具调用
        "knowledge_query", # 知识库查询
        "llm_chat",        # LLM 对话
        "condition",       # 条件分支
        "delay",           # 延时等待
        "script",          # 自定义脚本
        "web_automation",  # AI Web 自动化（探索/生成用例/执行测试）
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # start/end/engine_task/...
    label: Mapped[str] = mapped_column(String(200), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # 节点配置 (JSON)
    # engine_task: { engine_type, url, instruction }
    # mcp_tool: { service_id, tool_name, params }
    # knowledge_query: { query_template, limit }
    # llm_chat: { prompt_template, model }
    # condition: { expression, true_branch, false_branch }
    # delay: { seconds }
    # script: { code, language }
    config: Mapped[dict] = mapped_column(JSON, nullable=True)

    # UI 画布位置
    position_x: Mapped[float] = mapped_column(Float, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, default=0.0)

    workflow = relationship("Workflow", back_populates="nodes")


class WorkflowEdge(Base, TimestampMixin):
    """工作流边（连线）"""
    __tablename__ = "workflow_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    source_node_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=True)  # 条件标签（如 "通过"、"失败"）

    workflow = relationship("Workflow", back_populates="edges")


class WorkflowExecution(Base, TimestampMixin):
    """工作流执行记录"""
    __tablename__ = "workflow_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)  # pending / running / completed / failed / cancelled
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    error: Mapped[str] = mapped_column(Text, nullable=True)
    trigger: Mapped[str] = mapped_column(String(50), default="manual")  # manual / scheduled / webhook
    results: Mapped[dict] = mapped_column(JSON, nullable=True)  # 整体执行结果摘要

    node_executions = relationship("WorkflowNodeExecution", back_populates="execution", cascade="all, delete-orphan")


class WorkflowNodeExecution(Base, TimestampMixin):
    """节点执行记录"""
    __tablename__ = "workflow_node_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    execution_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflow_executions.id", ondelete="CASCADE"), nullable=False, index=True)
    node_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflow_nodes.id", ondelete="SET NULL"), nullable=True)
    node_type: Mapped[str] = mapped_column(String(30), nullable=False)
    node_label: Mapped[str] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending / running / completed / failed / skipped
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    input_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    output_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    error: Mapped[str] = mapped_column(Text, nullable=True)
    attempt: Mapped[int] = mapped_column(Integer, default=1)

    execution = relationship("WorkflowExecution", back_populates="node_executions")
