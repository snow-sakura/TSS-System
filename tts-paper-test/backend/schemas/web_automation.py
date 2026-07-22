"""Web自动化Schema"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


# 项目
class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=200)
    target_url: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    target_url: str
    description: Optional[str]
    status: str
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    page_count: int = 0
    test_case_count: int = 0

    class Config:
        from_attributes = True


# 页面
class PageResponse(BaseModel):
    id: int
    project_id: int
    url: str
    title: Optional[str]
    page_map: Optional[dict]
    screenshot_path: Optional[str]
    elements: Optional[dict | list] = None
    exploration_status: str
    created_at: datetime

    class Config:
        from_attributes = True


# 测试用例
class TestCaseCreate(BaseModel):
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    preconditions: Optional[str] = None
    steps: list[dict]
    expected_result: Optional[str] = None
    priority: str = "P2"
    page_id: Optional[int] = None


class TestCaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    preconditions: Optional[str] = None
    steps: Optional[list[dict]] = None
    expected_result: Optional[str] = None
    priority: Optional[str] = None


class TestCaseResponse(BaseModel):
    id: int
    project_id: int
    page_id: Optional[int]
    title: str
    description: Optional[str]
    preconditions: Optional[str]
    steps: list
    expected_result: Optional[str]
    priority: str
    status: str
    ai_generated: bool
    ai_model: Optional[str]
    review_note: Optional[str]
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# 执行
class ExecutionResponse(BaseModel):
    id: int
    project_id: int
    test_case_id: Optional[int]
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    screenshots: Optional[list]
    error_message: Optional[str]
    ai_analysis: Optional[str]
    executed_by: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
