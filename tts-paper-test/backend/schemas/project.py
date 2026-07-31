"""项目管理和版本管理 Schema"""

from typing import Optional, Union
from datetime import datetime, date
from pydantic import BaseModel, computed_field, Field


# ============ Project ============

class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=200)
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "draft"
    owner: Optional[int] = None
    start_date: Optional[Union[datetime, date, str]] = None
    end_date: Optional[Union[datetime, date, str]] = None

    model_config = {
        "arbitrary_types_allowed": True
    }


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[int] = None
    start_date: Optional[Union[datetime, date, str]] = None
    end_date: Optional[Union[datetime, date, str]] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    status: str
    owner: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectListParams(BaseModel):
    page: int = 1
    page_size: int = 20
    status: Optional[str] = None
    search: Optional[str] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"


# ============ Version ============

class VersionCreate(BaseModel):
    project_id: int
    name: str = Field(..., max_length=200)
    version_no: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "draft"
    release_date: Optional[datetime] = None


class VersionUpdate(BaseModel):
    project_id: Optional[int] = None
    name: Optional[str] = None
    version_no: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    release_date: Optional[datetime] = None


class VersionResponse(BaseModel):
    id: int
    project_id: int
    name: str
    version_number: Optional[str] = None
    description: Optional[str] = None
    status: str
    release_date: Optional[datetime] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def project_name(self) -> Optional[str]:
        if hasattr(self, 'project') and self.project:
            return self.project.name
        return None

    @computed_field
    @property
    def version_no(self) -> Optional[str]:
        return self.version_number

    class Config:
        from_attributes = True


class VersionListParams(BaseModel):
    page: int = 1
    page_size: int = 20
    project_id: Optional[int] = None
    status: Optional[str] = None
    search: Optional[str] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"
