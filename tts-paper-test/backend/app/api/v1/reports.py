"""
TSS AI测试平台 — 测试报告 API路由 (CRUD + AI生成)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import Report
from backend.app.schemas.schemas import (
    ReportCreate, ReportUpdate, ReportOut,
    ApiResponse, PaginatedResponse,
)

router = APIRouter(prefix="/reports", tags=["测试报告"])


@router.get("", response_model=ApiResponse)
def list_reports(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None), report_type: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status)
    if report_type:
        q = q.filter(Report.report_type == report_type)
    total = q.count()
    items = q.order_by(Report.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=PaginatedResponse(
        items=[ReportOut.model_validate(i).model_dump() for i in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))


@router.post("", response_model=ApiResponse)
def create_report(req: ReportCreate, db: Session = Depends(get_db)):
    report = Report(**req.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return ApiResponse(code=201, data=ReportOut.model_validate(report).model_dump())


@router.get("/{report_id}", response_model=ApiResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return ApiResponse(data=ReportOut.model_validate(report).model_dump())


@router.put("/{report_id}", response_model=ApiResponse)
def update_report(report_id: str, req: ReportUpdate, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(report, key, value)
    db.commit()
    return ApiResponse(data=ReportOut.model_validate(report).model_dump())


@router.delete("/{report_id}", response_model=ApiResponse)
def delete_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    db.delete(report)
    db.commit()
    return ApiResponse(message="删除成功")


@router.post("/ai-generate", response_model=ApiResponse)
def ai_generate_report(req: ReportCreate, db: Session = Depends(get_db)):
    """AI生成测试报告 (占位)"""
    # TODO: CrewAI集成
    return ApiResponse(message="AI报告生成功能开发中", data=req.model_dump())
