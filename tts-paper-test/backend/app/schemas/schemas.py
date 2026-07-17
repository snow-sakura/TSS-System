"""
TSS AI测试平台 — Pydantic 模式定义 (请求/响应)
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field, EmailStr


# ============================================================
# 通用
# ============================================================

class ApiResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Any = None


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int = 1
    page_size: int = 20
    total_pages: int = 0


# ============================================================
# 认证
# ============================================================

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    captcha_token: Optional[str] = None
    captcha_answer: Optional[int] = None


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Any = None


class RefreshRequest(BaseModel):
    refresh_token: str


class CaptchaResponse(BaseModel):
    question: str
    token: str


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    display_name: str
    avatar_url: str
    role: str
    status: str
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# 需求
# ============================================================

class RequirementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = ""
    doc_type: str = "text"


class RequirementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    doc_type: Optional[str] = None
    status: Optional[str] = None


class RequirementOut(BaseModel):
    id: str
    title: str
    content: str
    doc_type: str
    status: str
    ai_analysis: Any = None
    version: int
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    test_points_count: int = 0

    model_config = {"from_attributes": True}


# ============================================================
# 测试点
# ============================================================

class TestPointCreate(BaseModel):
    requirement_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    type: str = "functional"
    priority: str = "medium"
    category: str = ""


class TestPointUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None


class TestPointOut(BaseModel):
    id: str
    requirement_id: str
    title: str
    description: str
    type: str
    priority: str
    category: str
    status: str
    ai_generated: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AITestPointExtractRequest(BaseModel):
    requirement_id: str


# ============================================================
# 测试方案
# ============================================================

class TestPlanCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    requirement_ids: list[str] = []
    test_point_ids: list[str] = []


class TestPlanUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    requirement_ids: Optional[list[str]] = None
    test_point_ids: Optional[list[str]] = None


class TestPlanOut(BaseModel):
    id: str
    title: str
    description: str
    status: str
    ai_suggestion: Any = None
    requirement_ids: list[Any] = []
    test_point_ids: list[Any] = []
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# 测试用例
# ============================================================

class TestStepSchema(BaseModel):
    step: int
    action: str
    expected: str = ""


class TestCaseCreate(BaseModel):
    plan_id: Optional[str] = None
    test_point_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    precondition: str = ""
    steps: list[TestStepSchema] = []
    expected_result: str = ""
    priority: str = "p2"
    type: str = "functional"


class TestCaseUpdate(BaseModel):
    title: Optional[str] = None
    precondition: Optional[str] = None
    steps: Optional[list[TestStepSchema]] = None
    expected_result: Optional[str] = None
    actual_result: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None


class TestCaseOut(BaseModel):
    id: str
    plan_id: Optional[str] = None
    test_point_id: Optional[str] = None
    title: str
    precondition: str
    steps: list[Any] = []
    expected_result: str
    actual_result: str
    status: str
    priority: str
    type: str
    ai_generated: bool
    reviewed_by: Optional[str] = None
    confirmed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AITestCaseGenerateRequest(BaseModel):
    plan_id: Optional[str] = None
    test_point_ids: list[str] = []
    count: int = 5


# ============================================================
# 测试执行
# ============================================================

class TestExecutionCreate(BaseModel):
    plan_id: str
    name: str = Field(..., min_length=1, max_length=200)
    environment: str = ""


class TestExecutionOut(BaseModel):
    id: str
    plan_id: str
    name: str
    status: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    blocked_cases: int
    environment: str
    executed_by: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# 缺陷
# ============================================================

class DefectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    severity: str = "major"
    priority: str = "medium"
    test_case_id: Optional[str] = None


class DefectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    root_cause: Optional[str] = None
    solution: Optional[str] = None
    assigned_to: Optional[str] = None


class DefectOut(BaseModel):
    id: str
    title: str
    description: str
    severity: str
    priority: str
    status: str
    root_cause: str
    solution: str
    test_case_id: Optional[str] = None
    ai_analysis: Any = None
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    resolved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# 报告
# ============================================================

class ReportCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    report_type: str = "execution"
    execution_id: Optional[str] = None


class ReportUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    content: Optional[dict] = None


class ReportOut(BaseModel):
    id: str
    title: str
    description: str
    report_type: str
    status: str
    content: Any = None
    ai_generated: bool
    execution_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# 环境
# ============================================================

class EnvironmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    env_type: str = "test"
    config: dict = {}


class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    env_type: Optional[str] = None
    config: Optional[dict] = None
    status: Optional[str] = None


class EnvironmentOut(BaseModel):
    id: str
    name: str
    description: str
    env_type: str
    config: Any = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# LLM配置
# ============================================================

class LLMProviderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    provider_type: str = "openai"
    api_base: str = ""
    api_key: str = ""
    model_name: str = "gpt-4o"
    config: dict = {}


class LLMProviderOut(BaseModel):
    id: str
    name: str
    provider_type: str
    api_base: str
    model_name: str
    config: Any = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# MCP服务
# ============================================================

class MCPServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    service_type: str = "tool"
    endpoint: str = ""
    config: dict = {}


class MCPServiceOut(BaseModel):
    id: str
    name: str
    description: str
    service_type: str
    endpoint: str
    config: Any = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# 操作日志
# ============================================================

class OperationLogOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    username: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Any = None
    ip_address: str
    status: str
    duration_ms: int
    created_at: datetime

    model_config = {"from_attributes": True}
