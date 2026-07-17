"""
TSS AI测试平台 — 测试点管理 API路由 (CRUD + AI提取)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import TestPoint, Requirement
from backend.app.schemas.schemas import (
    TestPointCreate, TestPointUpdate, TestPointOut,
    AITestPointExtractRequest,
    ApiResponse, PaginatedResponse,
)
from backend.app.agents.agent_factory import orchestrator

router = APIRouter(prefix="/test-points", tags=["测试点管理"])


@router.get("", response_model=ApiResponse)
def list_test_points(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    requirement_id: str = Query(None),
    status: str = Query(None),
    priority: str = Query(None),
    db: Session = Depends(get_db),
):
    """测试点列表 (分页)"""
    q = db.query(TestPoint)
    if requirement_id:
        q = q.filter(TestPoint.requirement_id == requirement_id)
    if status:
        q = q.filter(TestPoint.status == status)
    if priority:
        q = q.filter(TestPoint.priority == priority)

    total = q.count()
    items = q.order_by(TestPoint.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return ApiResponse(data=PaginatedResponse(
        items=[TestPointOut.model_validate(i).model_dump() for i in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))


@router.post("", response_model=ApiResponse)
def create_test_point(req: TestPointCreate, db: Session = Depends(get_db)):
    """创建测试点"""
    tp = TestPoint(**req.model_dump())
    db.add(tp)
    db.commit()
    db.refresh(tp)
    return ApiResponse(code=201, data=TestPointOut.model_validate(tp).model_dump())


@router.get("/{tp_id}", response_model=ApiResponse)
def get_test_point(tp_id: str, db: Session = Depends(get_db)):
    """获取测试点详情"""
    tp = db.query(TestPoint).filter(TestPoint.id == tp_id).first()
    if not tp:
        raise HTTPException(status_code=404, detail="测试点不存在")
    return ApiResponse(data=TestPointOut.model_validate(tp).model_dump())


@router.put("/{tp_id}", response_model=ApiResponse)
def update_test_point(tp_id: str, req: TestPointUpdate, db: Session = Depends(get_db)):
    """更新测试点"""
    tp = db.query(TestPoint).filter(TestPoint.id == tp_id).first()
    if not tp:
        raise HTTPException(status_code=404, detail="测试点不存在")
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(tp, key, value)
    db.commit()
    db.refresh(tp)
    return ApiResponse(data=TestPointOut.model_validate(tp).model_dump())


@router.delete("/{tp_id}", response_model=ApiResponse)
def delete_test_point(tp_id: str, db: Session = Depends(get_db)):
    """删除测试点"""
    tp = db.query(TestPoint).filter(TestPoint.id == tp_id).first()
    if not tp:
        raise HTTPException(status_code=404, detail="测试点不存在")
    db.delete(tp)
    db.commit()
    return ApiResponse(message="删除成功")


@router.post("/batch-delete", response_model=ApiResponse)
def batch_delete_test_points(ids: list[str], db: Session = Depends(get_db)):
    """批量删除测试点"""
    deleted = db.query(TestPoint).filter(TestPoint.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return ApiResponse(message=f"成功删除 {deleted} 个测试点")


@router.post("/ai-extract", response_model=ApiResponse)
def ai_extract_test_points(req: AITestPointExtractRequest, db: Session = Depends(get_db)):
    """AI提取测试点"""
    requirement = db.query(Requirement).filter(Requirement.id == req.requirement_id).first()
    if not requirement:
        raise HTTPException(status_code=404, detail="需求不存在")

    # Agent提取
    result = orchestrator.analyze_requirement(requirement.title, requirement.content)
    test_points = result.get("test_points", [])

    created = []
    if isinstance(test_points, list):
        for tp in test_points:
            existing = db.query(TestPoint).filter(
                TestPoint.requirement_id == requirement.id,
                TestPoint.title == tp.get("title", "")
            ).first()
            if not existing:
                new_tp = TestPoint(
                    requirement_id=requirement.id,
                    title=tp.get("title", ""),
                    type=tp.get("type", "functional"),
                    priority=tp.get("priority", "medium"),
                    ai_generated=True,
                )
                db.add(new_tp)
                db.flush()
                created.append(TestPointOut.model_validate(new_tp).model_dump())

    db.commit()
    return ApiResponse(message=f"AI提取完成，新增 {len(created)} 个测试点", data=created)
