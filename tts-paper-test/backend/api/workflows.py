"""
工作流编排 API — 工作流 CRUD + 节点/边管理 + 执行

路径前缀: /api/v1/workflows
"""

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.workflow import (
    Workflow,
    WorkflowNode,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowNodeExecution,
)
from services.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/api/v1/workflows", tags=["工作流编排"])

# ── Pydantic Schema ──

class NodeSchema(BaseModel):
    type: str
    label: str = ""
    description: str = ""
    config: dict = {}
    position_x: float = 0.0
    position_y: float = 0.0

class EdgeSchema(BaseModel):
    source_node_id: int
    target_node_id: int
    label: str = ""

class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    tags: dict = {}

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[dict] = None

class WorkflowFullUpdate(BaseModel):
    """全量更新（保存整个画布）"""
    nodes: list[NodeSchema] = []
    edges: list[EdgeSchema] = []

class ExecutionResponse(BaseModel):
    id: int
    workflow_id: int
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
    trigger: str = "manual"

# ── 工作流 CRUD ──

@router.get("", summary="列出工作流")
async def list_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    query = select(Workflow)
    if status:
        query = query.where(Workflow.status == status)
    if search:
        query = query.where(Workflow.name.ilike(f"%{search}%"))
    query = query.order_by(Workflow.updated_at.desc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    rows = (await db.execute(query.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    return {
        "data": [_wf_to_dict(w) for w in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", summary="创建工作流")
async def create_workflow(body: WorkflowCreate, db: AsyncSession = Depends(get_db)) -> dict:
    wf = Workflow(name=body.name, description=body.description, tags=body.tags)
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return _wf_to_dict(wf)


@router.get("/{workflow_id}", summary="获取工作流详情")
async def get_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    wf = await _get_wf_or_404(workflow_id, db)
    return _wf_detail_dict(wf)


@router.put("/{workflow_id}", summary="更新工作流")
async def update_workflow(workflow_id: int, body: WorkflowUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    wf = await _get_wf_or_404(workflow_id, db)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(wf, field, val)
    await db.commit()
    await db.refresh(wf)
    return _wf_to_dict(wf)


@router.delete("/{workflow_id}", summary="删除工作流")
async def delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    wf = await _get_wf_or_404(workflow_id, db)
    await db.delete(wf)
    await db.commit()
    return {"ok": True}


# ── 画布全量保存 ──

@router.put("/{workflow_id}/canvas", summary="保存整个画布（节点+边）")
async def save_canvas(workflow_id: int, body: WorkflowFullUpdate, db: AsyncSession = Depends(get_db)):
    wf = await _get_wf_or_404(workflow_id, db)

    # 删除旧节点和边
    await db.execute(delete(WorkflowEdge).where(WorkflowEdge.workflow_id == workflow_id))
    await db.execute(delete(WorkflowNode).where(WorkflowNode.workflow_id == workflow_id))
    await db.flush()

    # 创建节点并建立 id 映射
    old_to_new = {}
    for i, ns in enumerate(body.nodes):
        node = WorkflowNode(
            workflow_id=workflow_id,
            type=ns.type,
            label=ns.label or ns.type,
            description=ns.description,
            config=ns.config,
            position_x=ns.position_x,
            position_y=ns.position_y,
        )
        db.add(node)
        await db.flush()
        old_to_new[i] = node.id  # 用下标映射

    # 创建边
    for es in body.edges:
        src = old_to_new.get(es.source_node_id)
        tgt = old_to_new.get(es.target_node_id)
        if src is None or tgt is None:
            continue
        edge = WorkflowEdge(
            workflow_id=workflow_id,
            source_node_id=src,
            target_node_id=tgt,
            label=es.label,
        )
        db.add(edge)

    await db.commit()
    return {"ok": True, "workflow_id": workflow_id}


# ── 节点 CRUD ──

@router.post("/{workflow_id}/nodes", summary="添加节点")
async def add_node(workflow_id: int, body: NodeSchema, db: AsyncSession = Depends(get_db)) -> dict:
    await _get_wf_or_404(workflow_id, db)
    node = WorkflowNode(
        workflow_id=workflow_id,
        type=body.type,
        label=body.label or body.type,
        description=body.description,
        config=body.config,
        position_x=body.position_x,
        position_y=body.position_y,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return _node_dict(node)


@router.put("/{workflow_id}/nodes/{node_id}", summary="更新节点")
async def update_node(workflow_id: int, node_id: int, body: NodeSchema, db: AsyncSession = Depends(get_db)) -> dict:
    node = await _get_node_or_404(workflow_id, node_id, db)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(node, field, val)
    await db.commit()
    await db.refresh(node)
    return _node_dict(node)


@router.delete("/{workflow_id}/nodes/{node_id}", summary="删除节点")
async def delete_node(workflow_id: int, node_id: int, db: AsyncSession = Depends(get_db)):
    await _get_node_or_404(workflow_id, node_id, db)
    await db.execute(delete(WorkflowEdge).where(
        (WorkflowEdge.source_node_id == node_id) | (WorkflowEdge.target_node_id == node_id)
    ))
    await db.execute(delete(WorkflowNode).where(WorkflowNode.id == node_id))
    await db.commit()
    return {"ok": True}


# ── 边 CRUD ──

@router.post("/{workflow_id}/edges", summary="添加连线")
async def add_edge(workflow_id: int, body: EdgeSchema, db: AsyncSession = Depends(get_db)) -> dict:
    edge = WorkflowEdge(
        workflow_id=workflow_id,
        source_node_id=body.source_node_id,
        target_node_id=body.target_node_id,
        label=body.label,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return _edge_dict(edge)


@router.delete("/{workflow_id}/edges/{edge_id}", summary="删除连线")
async def delete_edge(workflow_id: int, edge_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkflowEdge).where(WorkflowEdge.id == edge_id, WorkflowEdge.workflow_id == workflow_id)
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(404, "连线不存在")
    await db.delete(edge)
    await db.commit()
    return {"ok": True}


# ── 执行 ──

@router.post("/{workflow_id}/execute", summary="执行工作流")
async def execute_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    engine = WorkflowEngine(db)
    execution = await engine.execute_workflow(workflow_id)
    return _exec_dict(execution)


@router.get("/{workflow_id}/executions", summary="执行记录列表")
async def list_executions(
    workflow_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict:
    query = select(WorkflowExecution).where(WorkflowExecution.workflow_id == workflow_id).order_by(WorkflowExecution.id.desc())
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    rows = (await db.execute(query.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return {
        "data": [_exec_dict(e) for e in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/executions/{execution_id}", summary="执行详情")
async def get_execution(execution_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(select(WorkflowExecution).where(WorkflowExecution.id == execution_id))
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(404, "执行记录不存在")
    d = _exec_dict(execution)
    d["node_executions"] = [_node_exec_dict(ne) for ne in execution.node_executions]
    return d


# ── 辅助 ──

async def _get_wf_or_404(wf_id: int, db: AsyncSession) -> Workflow:
    result = await db.execute(select(Workflow).where(Workflow.id == wf_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "工作流不存在")
    return wf


async def _get_node_or_404(wf_id: int, node_id: int, db: AsyncSession) -> WorkflowNode:
    result = await db.execute(
        select(WorkflowNode).where(WorkflowNode.id == node_id, WorkflowNode.workflow_id == wf_id)
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(404, "节点不存在")
    return node


def _wf_to_dict(wf: Workflow) -> dict:
    return {
        "id": wf.id,
        "name": wf.name,
        "description": wf.description or "",
        "status": wf.status,
        "tags": wf.tags or {},
        "node_count": len(wf.nodes) if wf.nodes else 0,
        "edge_count": len(wf.edges) if wf.edges else 0,
        "created_at": wf.created_at.isoformat() if wf.created_at else None,
        "updated_at": wf.updated_at.isoformat() if wf.updated_at else None,
    }


def _wf_detail_dict(wf: Workflow) -> dict:
    d = _wf_to_dict(wf)
    d["nodes"] = [_node_dict(n) for n in (wf.nodes or [])]
    d["edges"] = [_edge_dict(e) for e in (wf.edges or [])]
    return d


def _node_dict(n: WorkflowNode) -> dict:
    return {
        "id": n.id,
        "workflow_id": n.workflow_id,
        "type": n.type,
        "label": n.label or n.type,
        "description": n.description or "",
        "config": n.config or {},
        "position_x": n.position_x,
        "position_y": n.position_y,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def _edge_dict(e: WorkflowEdge) -> dict:
    return {
        "id": e.id,
        "workflow_id": e.workflow_id,
        "source_node_id": e.source_node_id,
        "target_node_id": e.target_node_id,
        "label": e.label or "",
    }


def _exec_dict(e: WorkflowExecution) -> dict:
    return {
        "id": e.id,
        "workflow_id": e.workflow_id,
        "status": e.status,
        "trigger": e.trigger,
        "error": e.error or "",
        "started_at": e.started_at.isoformat() if e.started_at else None,
        "finished_at": e.finished_at.isoformat() if e.finished_at else None,
    }


def _node_exec_dict(ne: WorkflowNodeExecution) -> dict:
    return {
        "id": ne.id,
        "execution_id": ne.execution_id,
        "node_id": ne.node_id,
        "node_type": ne.node_type,
        "node_label": ne.node_label or "",
        "status": ne.status,
        "error": ne.error or "",
        "started_at": ne.started_at.isoformat() if ne.started_at else None,
        "finished_at": ne.finished_at.isoformat() if ne.finished_at else None,
        "input_data": ne.input_data,
        "output_data": ne.output_data,
        "attempt": ne.attempt,
    }
