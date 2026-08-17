"""Web自动化Schema"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, model_validator


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
class ExecuteRequest(BaseModel):
    """执行请求：可选指定用例ID列表与引擎类型，不传则执行全部已审批用例"""

    case_ids: Optional[list[int]] = None
    engine: Optional[str] = None


# 对象库（页面元素）
class UIElementCreate(BaseModel):
    name: str = Field(..., max_length=200)
    element_type: Optional[str] = None
    locator: Optional[str] = None
    locator_type: Optional[str] = "css"
    backup_locators: Optional[list[str]] = None
    wait_timeout: Optional[int] = Field(default=5, ge=1, le=60)
    force_action: Optional[bool] = False
    attributes: Optional[dict] = None
    description: Optional[str] = None


class UIElementUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    element_type: Optional[str] = None
    locator: Optional[str] = None
    locator_type: Optional[str] = None
    backup_locators: Optional[list[str]] = None
    wait_timeout: Optional[int] = Field(None, ge=1, le=60)
    force_action: Optional[bool] = None
    attributes: Optional[dict] = None
    description: Optional[str] = None


class UIElementResponse(BaseModel):
    id: int
    project_id: int
    page_id: Optional[int]
    name: str
    element_type: Optional[str]
    locator: Optional[str]
    locator_type: Optional[str] = "css"
    backup_locators: Optional[list[str]] = None
    wait_timeout: Optional[int] = 5
    force_action: Optional[bool] = False
    attributes: Optional[dict]
    description: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ObjectRepoPageResponse(BaseModel):
    """对象库中的页面对象（含元素统计）"""

    id: int
    project_id: int
    url: str
    title: Optional[str]
    screenshot_path: Optional[str]
    element_count: int = 0
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


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
    execution_case_ids: Optional[list[int]] = None
    case_titles: Optional[list[str]] = None
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    screenshots: Optional[list]
    step_results: Optional[list] = None
    error_message: Optional[str]
    ai_analysis: Optional[str]
    executed_by: Optional[int]
    created_at: datetime

    @model_validator(mode="after")
    def _backfill_case_ids(self):
        """旧数据兼容：execution_case_ids 为空时回退到 test_case_id"""
        if not self.execution_case_ids and self.test_case_id:
            self.execution_case_ids = [self.test_case_id]
        return self

    class Config:
        from_attributes = True
