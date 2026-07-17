"""
TSS AI测试平台 — 测试用例 API路由 (CRUD + AI生成)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import TestCase, TestPoint, AIGeneration
from backend.app.schemas.schemas import (
    TestCaseCreate, TestCaseUpdate, TestCaseOut,
    AITestCaseGenerateRequest,
    ApiResponse, PaginatedResponse,
)
from backend.app.agents.agent_factory import orchestrator

router = APIRouter(prefix="/test-cases", tags=["测试用例"])


@router.get("", response_model=ApiResponse)
def list_test_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    plan_id: str = Query(None),
    test_point_id: str = Query(None),
    status: str = Query(None),
    priority: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(TestCase)
    if plan_id:
        q = q.filter(TestCase.plan_id == plan_id)
    if test_point_id:
        q = q.filter(TestCase.test_point_id == test_point_id)
    if status:
        q = q.filter(TestCase.status == status)
    if priority:
        q = q.filter(TestCase.priority == priority)
    total = q.count()
    items = q.order_by(TestCase.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=PaginatedResponse(
        items=[TestCaseOut.model_validate(i).model_dump() for i in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))


@router.post("", response_model=ApiResponse)
def create_test_case(req: TestCaseCreate, db: Session = Depends(get_db)):
    tc = TestCase(**req.model_dump())
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return ApiResponse(code=201, data=TestCaseOut.model_validate(tc).model_dump())


@router.get("/{case_id}", response_model=ApiResponse)
def get_test_case(case_id: str, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="用例不存在")
    return ApiResponse(data=TestCaseOut.model_validate(tc).model_dump())


@router.put("/{case_id}", response_model=ApiResponse)
def update_test_case(case_id: str, req: TestCaseUpdate, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="用例不存在")
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(tc, key, value)
    db.commit()
    db.refresh(tc)
    return ApiResponse(data=TestCaseOut.model_validate(tc).model_dump())


@router.delete("/{case_id}", response_model=ApiResponse)
def delete_test_case(case_id: str, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="用例不存在")
    db.delete(tc)
    db.commit()
    return ApiResponse(message="删除成功")


@router.post("/ai-generate", response_model=ApiResponse)
def ai_generate_test_cases(req: AITestCaseGenerateRequest, db: Session = Depends(get_db)):
    """AI生成测试用例"""
    # 获取测试点
    test_points = db.query(TestPoint).filter(TestPoint.id.in_(req.test_point_ids)).all()
    tp_titles = [tp.title for tp in test_points]

    # Agent生成
    result = orchestrator.generate_test_cases(tp_titles, req.count)

    created = []
    for tc_data in result:
        tc = TestCase(
            plan_id=req.plan_id,
            title=tc_data.get("title", ""),
            precondition=tc_data.get("precondition", ""),
            steps=tc_data.get("steps", []),
            priority=tc_data.get("priority", "p2"),
            ai_generated=True,
            status="draft",
        )
        db.add(tc)
        db.flush()
        created.append(TestCaseOut.model_validate(tc).model_dump())

    db.commit()
    return ApiResponse(message=f"AI生成了 {len(created)} 条用例，请审核后确认", data=created)


@router.post("/{case_id}/confirm", response_model=ApiResponse)
def confirm_test_case(case_id: str, db: Session = Depends(get_db)):
    """确认用例 (人工审核后)"""
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="用例不存在")
    tc.status = "approved"
    db.commit()
    return ApiResponse(data=TestCaseOut.model_validate(tc).model_dump())
