"""
TSS AI测试平台 — 测试执行 API路由 (CRUD)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import TestExecution
from backend.app.schemas.schemas import (
    TestExecutionCreate, TestExecutionOut,
    ApiResponse, PaginatedResponse,
)

router = APIRouter(prefix="/executions", tags=["测试执行"])


@router.get("", response_model=ApiResponse)
def list_executions(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    plan_id: str = Query(None), status: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(TestExecution)
    if plan_id:
        q = q.filter(TestExecution.plan_id == plan_id)
    if status:
        q = q.filter(TestExecution.status == status)
    total = q.count()
    items = q.order_by(TestExecution.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=PaginatedResponse(
        items=[TestExecutionOut.model_validate(i).model_dump() for i in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))


@router.post("", response_model=ApiResponse)
def create_execution(req: TestExecutionCreate, db: Session = Depends(get_db)):
    exec_ = TestExecution(**req.model_dump())
    db.add(exec_)
    db.commit()
    db.refresh(exec_)
    return ApiResponse(code=201, data=TestExecutionOut.model_validate(exec_).model_dump())


@router.get("/{exec_id}", response_model=ApiResponse)
def get_execution(exec_id: str, db: Session = Depends(get_db)):
    exec_ = db.query(TestExecution).filter(TestExecution.id == exec_id).first()
    if not exec_:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    return ApiResponse(data=TestExecutionOut.model_validate(exec_).model_dump())


@router.post("/{exec_id}/start", response_model=ApiResponse)
def start_execution(exec_id: str, db: Session = Depends(get_db)):
    exec_ = db.query(TestExecution).filter(TestExecution.id == exec_id).first()
    if not exec_:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    exec_.status = "running"
    exec_.started_at = __import__("datetime").datetime.now()
    db.commit()
    return ApiResponse(data=TestExecutionOut.model_validate(exec_).model_dump())
