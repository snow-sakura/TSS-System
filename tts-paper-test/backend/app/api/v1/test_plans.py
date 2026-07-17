"""
TSS AI测试平台 — 测试方案 API路由 (CRUD + AI建议)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import TestPlan, Requirement
from backend.app.schemas.schemas import (
    TestPlanCreate, TestPlanUpdate, TestPlanOut,
    ApiResponse, PaginatedResponse,
)
from backend.app.agents.agent_factory import orchestrator

router = APIRouter(prefix="/test-plans", tags=["测试方案"])


@router.get("", response_model=ApiResponse)
def list_test_plans(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    db: Session = Depends(get_db),
):
    """测试方案列表"""
    q = db.query(TestPlan)
    if status:
        q = q.filter(TestPlan.status == status)
    total = q.count()
    items = q.order_by(TestPlan.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=PaginatedResponse(
        items=[TestPlanOut.model_validate(i).model_dump() for i in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))


@router.post("", response_model=ApiResponse)
def create_test_plan(req: TestPlanCreate, db: Session = Depends(get_db)):
    """创建测试方案"""
    plan = TestPlan(**req.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return ApiResponse(code=201, data=TestPlanOut.model_validate(plan).model_dump())


@router.get("/{plan_id}", response_model=ApiResponse)
def get_test_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = db.query(TestPlan).filter(TestPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="方案不存在")
    return ApiResponse(data=TestPlanOut.model_validate(plan).model_dump())


@router.put("/{plan_id}", response_model=ApiResponse)
def update_test_plan(plan_id: str, req: TestPlanUpdate, db: Session = Depends(get_db)):
    plan = db.query(TestPlan).filter(TestPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="方案不存在")
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return ApiResponse(data=TestPlanOut.model_validate(plan).model_dump())


@router.delete("/{plan_id}", response_model=ApiResponse)
def delete_test_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = db.query(TestPlan).filter(TestPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="方案不存在")
    db.delete(plan)
    db.commit()
    return ApiResponse(message="删除成功")


@router.post("/{plan_id}/ai-suggest", response_model=ApiResponse)
def ai_suggest_plan(plan_id: str, db: Session = Depends(get_db)):
    """AI生成方案建议"""
    plan = db.query(TestPlan).filter(TestPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="方案不存在")

    # 收集关联需求的标题用于分析
    req_titles = []
    for rid in (plan.requirement_ids or []):
        req = db.query(Requirement).filter(Requirement.id == rid).first()
        if req:
            req_titles.append(req.title)

    content = f"方案: {plan.title}\n关联需求: {', '.join(req_titles)}"
    result = orchestrator.analyze_requirement(plan.title, content)
    plan.ai_suggestion = result.get("analysis", result)
    db.commit()
    return ApiResponse(data=TestPlanOut.model_validate(plan).model_dump())
