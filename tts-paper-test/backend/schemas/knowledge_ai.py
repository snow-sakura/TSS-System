"""知识库 AI 增强 - Pydantic Schema"""

from typing import Optional
from pydantic import BaseModel


class AIExtractRequest(BaseModel):
    """AI 自动提取请求"""
    execution_id: int


class AIExtractResponse(BaseModel):
    """AI 自动提取响应"""
    success: bool
    extracted_type: Optional[str] = None
    pattern_id: Optional[int] = None
    bug_id: Optional[int] = None
    title: Optional[str] = None
    reason: Optional[str] = None
    error: Optional[str] = None


class AISearchRequest(BaseModel):
    """AI 搜索请求"""
    query: str
    search_type: Optional[str] = "all"
    limit: Optional[int] = 10


class AISearchResponseItem(BaseModel):
    """AI 搜索结果项"""
    id: int
    type: str
    title: str
    content: str
    relevance_score: float = 0.0
    metadata: Optional[dict] = None


class AISearchResponse(BaseModel):
    """AI 搜索响应"""
    query: str
    rewritten_query: Optional[str] = None
    answer: Optional[str] = None
    key_insights: list[str] = []
    related_topics: list[str] = []
    results: list[AISearchResponseItem] = []
    total: int = 0


class SuggestPatternRequest(BaseModel):
    """模式建议请求"""
    text: str
    context: Optional[str] = None


class SuggestPatternResponse(BaseModel):
    """模式建议响应"""
    success: bool
    extracted: bool = False
    type: Optional[str] = None
    suggestion: Optional[dict] = None
    reason: Optional[str] = None


class AutoCreateBugRequest(BaseModel):
    """自动创建 Bug 请求"""
    execution_id: int
    node_execution_id: int


class AutoCreateBugResponse(BaseModel):
    """自动创建 Bug 响应"""
    success: bool
    bug_id: Optional[int] = None
    title: Optional[str] = None
    reason: Optional[str] = None
    error: Optional[str] = None
