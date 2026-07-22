"""通用Schema"""

from typing import Any, Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar("T")


class ResponseModel(BaseModel):
    """统一响应格式"""
    success: bool = True
    message: str = "操作成功"
    data: Any = None


class PaginatedResponse(BaseModel):
    """分页响应"""
    items: list = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    pages: int = 0


class TokenResponse(BaseModel):
    """Token响应"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
