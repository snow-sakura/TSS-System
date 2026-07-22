"""测试生命周期 Schema"""
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ============ 需求 ============
class RequirementCreate(BaseModel):
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    priority: str = "P2"
    source: Optional[str] = "manual"
    tags: Optional[list[str]] = None
    deadline: Optional[str] = None


class RequirementUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[str] = None
    tags: Optional[list[str]] = None


class RequirementResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: str
    priority: str
    source: Optional[str] = None
    tags: Optional[list] = None
    deadline: Optional[str] = None
    ai_analysis: Optional[dict] = None
    ai_analysis_md: Optional[str] = None
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    parse_status: Optional[str] = None
    parse_error: Optional[str] = None
    raw_content: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RequirementListParams(BaseModel):
    """需求列表查询参数"""
    page: int = 1
    page_size: int = 20
    status: Optional[str] = None
    priority: Optional[str] = None
    source: Optional[str] = None
    search: Optional[str] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"


# ============ 测试方案 ============
class TestPlanCreate(BaseModel):
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    priority: str = "P2"
    scope: Optional[str] = None
    requirement_ids: Optional[list[int]] = None


class TestPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    scope: Optional[str] = None


class TestPlanResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: str
    priority: str
    scope: Optional[str] = None
    risk_level: Optional[str] = None
    strategy: Optional[dict] = None
    ai_suggestions: Optional[dict] = None
    requirement_ids: Optional[list] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ 测试点 ============
class TestPointCreate(BaseModel):
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    priority: str = "P2"
    category: Optional[str] = None
    requirement_id: Optional[int] = None
    plan_id: Optional[int] = None


class TestPointUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None


class TestPointResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: str
    priority: str
    category: Optional[str] = None
    coverage: Optional[float] = None
    requirement_id: Optional[int] = None
    plan_id: Optional[int] = None
    ai_extracted: bool = False
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ 测试用例 ============
class TestCaseCreate(BaseModel):
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    preconditions: Optional[str] = None
    steps: list[dict] = []
    expected_result: Optional[str] = None
    priority: str = "P2"
    test_type: Optional[str] = None
    requirement_id: Optional[int] = None
    test_point_id: Optional[int] = None
    plan_id: Optional[int] = None


class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    preconditions: Optional[str] = None
    steps: Optional[list[dict]] = None
    expected_result: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None


class TestCaseReviewCreate(BaseModel):
    """用例评审"""
    action: str = Field(..., description="评审动作: approved / rejected / needs_modification")
    review_comment: Optional[str] = None


class TestCaseResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    preconditions: Optional[str] = None
    steps: list
    expected_result: Optional[str] = None
    status: str
    priority: str
    test_type: Optional[str] = None
    requirement_id: Optional[int] = None
    test_point_id: Optional[int] = None
    plan_id: Optional[int] = None
    ai_generated: bool = False
    ai_model: Optional[str] = None
    reviewed_by: Optional[int] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ 测试执行 ============
class ExecutionCreate(BaseModel):
    name: str = Field(..., max_length=500)
    test_type: Optional[str] = None
    environment: Optional[str] = None
    test_case_ids: Optional[list[int]] = None
    plan_id: Optional[int] = None
    triggered_by: str = "manual"


class ExecutionUpdate(BaseModel):
    status: Optional[str] = None
    total_cases: Optional[int] = None
    passed: Optional[int] = None
    failed: Optional[int] = None
    blocked: Optional[int] = None
    pass_rate: Optional[float] = None
    completed_at: Optional[datetime] = None


class ExecutionResponse(BaseModel):
    id: int
    name: str
    status: str
    test_type: Optional[str] = None
    environment: Optional[str] = None
    total_cases: int = 0
    passed: int = 0
    failed: int = 0
    blocked: int = 0
    pass_rate: float = 0.0
    duration_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    test_case_ids: Optional[list] = None
    plan_id: Optional[int] = None
    triggered_by: str = "manual"
    executed_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ 缺陷 ============
class DefectCreate(BaseModel):
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    priority: str = "medium"
    severity: str = "major"
    steps_to_reproduce: Optional[list[dict]] = None
    actual_result: Optional[str] = None
    expected_result: Optional[str] = None
    environment: Optional[str] = None
    module: Optional[str] = None
    execution_id: Optional[int] = None
    test_case_id: Optional[int] = None


class DefectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    severity: Optional[str] = None
    assigned_to: Optional[int] = None
    root_cause: Optional[str] = None


class DefectResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    severity: str
    steps_to_reproduce: Optional[list] = None
    actual_result: Optional[str] = None
    expected_result: Optional[str] = None
    environment: Optional[str] = None
    module: Optional[str] = None
    root_cause: Optional[str] = None
    root_cause_ai: Optional[dict] = None
    execution_id: Optional[int] = None
    test_case_id: Optional[int] = None
    assigned_to: Optional[int] = None
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ 测试报告 ============
class ReportCreate(BaseModel):
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    report_type: Optional[str] = None
    execution_ids: Optional[list[int]] = None
    defect_ids: Optional[list[int]] = None
    plan_id: Optional[int] = None


class ReportUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    conclusion: Optional[str] = None


class ReportResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: str
    report_type: Optional[str] = None
    summary: Optional[dict] = None
    metrics: Optional[dict] = None
    ai_analysis: Optional[dict] = None
    conclusion: Optional[str] = None
    recommendations: Optional[dict] = None
    execution_ids: Optional[list] = None
    defect_ids: Optional[list] = None
    plan_id: Optional[int] = None
    ai_generated: bool = False
    created_by: Optional[int] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
