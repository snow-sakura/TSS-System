"""
TSS AI测试平台 — 需求管理 API路由 (CRUD + AI分析)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import Requirement, TestPoint, AIGeneration
from backend.app.schemas.schemas import (
    RequirementCreate, RequirementUpdate, RequirementOut,
    ApiResponse, PaginatedResponse,
)
from backend.app.agents.agent_factory import orchestrator

router = APIRouter(prefix="/requirements", tags=["需求管理"])


@router.get("", response_model=ApiResponse)
def list_requirements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
):
    """需求列表 (分页)"""
    q = db.query(Requirement)
    if status:
        q = q.filter(Requirement.status == status)
    if search:
        q = q.filter(Requirement.title.ilike(f"%{search}%"))

    total = q.count()
    items = q.order_by(Requirement.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # 补充测试点计数
    result = []
    for item in items:
        out = RequirementOut.model_validate(item)
        out.test_points_count = db.query(TestPoint).filter(TestPoint.requirement_id == item.id).count()
        result.append(out)

    return ApiResponse(data=PaginatedResponse(
        items=[r.model_dump() for r in result],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    ))


@router.post("", response_model=ApiResponse)
def create_requirement(req: RequirementCreate, db: Session = Depends(get_db)):
    """创建需求"""
    requirement = Requirement(
        title=req.title, content=req.content, doc_type=req.doc_type,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return ApiResponse(code=201, data=RequirementOut.model_validate(requirement).model_dump())


@router.get("/{requirement_id}", response_model=ApiResponse)
def get_requirement(requirement_id: str, db: Session = Depends(get_db)):
    """获取需求详情"""
    item = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="需求不存在")
    out = RequirementOut.model_validate(item)
    out.test_points_count = db.query(TestPoint).filter(TestPoint.requirement_id == item.id).count()
    return ApiResponse(data=out.model_dump())


@router.put("/{requirement_id}", response_model=ApiResponse)
def update_requirement(requirement_id: str, req: RequirementUpdate, db: Session = Depends(get_db)):
    """更新需求"""
    item = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="需求不存在")
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    item.version += 1
    db.commit()
    db.refresh(item)
    return ApiResponse(data=RequirementOut.model_validate(item).model_dump())


@router.delete("/{requirement_id}", response_model=ApiResponse)
def delete_requirement(requirement_id: str, db: Session = Depends(get_db)):
    """删除需求"""
    item = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="需求不存在")
    db.delete(item)
    db.commit()
    return ApiResponse(message="删除成功")


@router.post("/{requirement_id}/analyze", response_model=ApiResponse)
def analyze_requirement(requirement_id: str, db: Session = Depends(get_db)):
    """AI分析需求 (CrewAI Agent)"""
    item = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="需求不存在")

    # Agent分析
    result = orchestrator.analyze_requirement(item.title, item.content)

    # 记录AI生成
    gen = AIGeneration(
        agent_type="requirement_analyzer",
        resource_type="requirement",
        resource_id=item.id,
        input_data={"title": item.title, "content_preview": item.content[:200]},
        output_data=result,
        status="draft",
        model_used="simulated" if result.get("agent_results", [{}])[0].get("simulated") else "crewai",
    )
    db.add(gen)

    # 自动生成测试点
    test_points = result.get("test_points", [])
    if isinstance(test_points, list):
        for tp in test_points:
            existing = db.query(TestPoint).filter(
                TestPoint.requirement_id == item.id,
                TestPoint.title == tp.get("title", "")
            ).first()
            if not existing:
                db.add(TestPoint(
                    requirement_id=item.id,
                    title=tp.get("title", ""),
                    type=tp.get("type", "functional"),
                    priority=tp.get("priority", "medium"),
                    ai_generated=True,
                ))

    item.status = "analyzed"
    item.ai_analysis = result.get("analysis", {})
    db.commit()
    return ApiResponse(data=RequirementOut.model_validate(item).model_dump())


@router.post("/{requirement_id}/approve", response_model=ApiResponse)
def approve_requirement(requirement_id: str, db: Session = Depends(get_db)):
    """审批通过需求"""
    item = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="需求不存在")
    item.status = "approved"
    db.commit()
    return ApiResponse(data=RequirementOut.model_validate(item).model_dump())
