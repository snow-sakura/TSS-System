"""
TSS AI测试平台 — 缺陷管理 API路由 (CRUD + AI分析)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import Defect
from backend.app.schemas.schemas import (
    DefectCreate, DefectUpdate, DefectOut,
    ApiResponse, PaginatedResponse,
)
from backend.app.agents.agent_factory import orchestrator

router = APIRouter(prefix="/defects", tags=["缺陷管理"])


@router.get("", response_model=ApiResponse)
def list_defects(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None), severity: str = Query(None),
    assigned_to: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Defect)
    if status:
        q = q.filter(Defect.status == status)
    if severity:
        q = q.filter(Defect.severity == severity)
    if assigned_to:
        q = q.filter(Defect.assigned_to == assigned_to)
    total = q.count()
    items = q.order_by(Defect.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=PaginatedResponse(
        items=[DefectOut.model_validate(i).model_dump() for i in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))


@router.post("", response_model=ApiResponse)
def create_defect(req: DefectCreate, db: Session = Depends(get_db)):
    defect = Defect(**req.model_dump())
    db.add(defect)
    db.commit()
    db.refresh(defect)
    return ApiResponse(code=201, data=DefectOut.model_validate(defect).model_dump())


@router.get("/{defect_id}", response_model=ApiResponse)
def get_defect(defect_id: str, db: Session = Depends(get_db)):
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    return ApiResponse(data=DefectOut.model_validate(defect).model_dump())


@router.put("/{defect_id}", response_model=ApiResponse)
def update_defect(defect_id: str, req: DefectUpdate, db: Session = Depends(get_db)):
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(defect, key, value)
    db.commit()
    db.refresh(defect)
    return ApiResponse(data=DefectOut.model_validate(defect).model_dump())


@router.delete("/{defect_id}", response_model=ApiResponse)
def delete_defect(defect_id: str, db: Session = Depends(get_db)):
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")
    db.delete(defect)
    db.commit()
    return ApiResponse(message="删除成功")


@router.post("/{defect_id}/analyze", response_model=ApiResponse)
def analyze_defect(defect_id: str, db: Session = Depends(get_db)):
    """AI分析缺陷根因"""
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="缺陷不存在")

    result = orchestrator.analyze_defect(defect.title, defect.description)
    defect.ai_analysis = result
    db.commit()
    return ApiResponse(data=DefectOut.model_validate(defect).model_dump())
