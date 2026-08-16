"""AI接口自动化Schema"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


# ── 项目 ──
class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=200)
    base_url: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    base_url: str
    description: Optional[str]
    status: str
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    endpoint_count: int = 0
    case_count: int = 0

    class Config:
        from_attributes = True


# ── 环境配置 ──
class EnvironmentCreate(BaseModel):
    name: str = Field(..., max_length=100)
    base_url: str
    auth_type: Optional[str] = "无"
    auth_config: Optional[dict] = None


class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    auth_type: Optional[str] = None
    auth_config: Optional[dict] = None


class EnvironmentResponse(BaseModel):
    id: int
    name: str
    base_url: str
    auth_type: str
    auth_config: Optional[dict]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── 接口端点 ──
class EndpointCreate(BaseModel):
    project_id: int
    name: str = Field(..., max_length=200)
    method: str = "GET"
    url: str
    headers: Optional[dict] = None
    params: Optional[dict] = None
    body: Optional[dict] = None


class EndpointUpdate(BaseModel):
    name: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[dict] = None
    params: Optional[dict] = None
    body: Optional[dict] = None


class EndpointResponse(BaseModel):
    id: int
    project_id: int
    name: str
    method: str
    url: str
    headers: Optional[dict]
    params: Optional[dict]
    body: Optional[dict]
    status: str
    response_time_ms: Optional[int]
    last_checked_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ── 测试用例 ──
class TestCaseCreate(BaseModel):
    project_id: int
    name: str = Field(..., max_length=500)
    endpoint_id: Optional[int] = None
    method: str = "GET"
    url: str
    expected_status: int = 200
    priority: str = "P1"
    source: str = "手动"
    ai_model: Optional[str] = None


class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    endpoint_id: Optional[int] = None
    method: Optional[str] = None
    url: Optional[str] = None
    expected_status: Optional[int] = None
    priority: Optional[str] = None


class TestCaseResponse(BaseModel):
    id: int
    project_id: int
    endpoint_id: Optional[int]
    name: str
    method: str
    url: str
    expected_status: int
    priority: str
    status: str
    source: str
    ai_model: Optional[str]
    last_result: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


# ── 执行 ──
class ExecuteRequest(BaseModel):
    """执行请求：可选指定用例ID列表，不传则执行该项目的全部用例"""

    case_ids: Optional[list[int]] = None


class TestExecutionResponse(BaseModel):
    id: int
    project_id: int
    name: str
    case_ids: Optional[list[int]]
    total: int
    passed: int
    failed: int
    pass_rate: float
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    results: Optional[list]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── 报告 ──
class ReportResponse(BaseModel):
    id: int
    project_id: int
    name: str
    report_type: str
    total_cases: int
    passed: int
    pass_rate: float
    content: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
