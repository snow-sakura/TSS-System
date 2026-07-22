"""知识库 - Pydantic Schema"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ============================
# 测试模式库
# ============================

class TestPatternCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    steps: Optional[str] = None
    expected_result: Optional[str] = None
    applicable_scenarios: Optional[str] = None
    examples: Optional[str] = None
    tags: Optional[str] = None
    status: Optional[str] = "启用"


class TestPatternUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[str] = None
    expected_result: Optional[str] = None
    applicable_scenarios: Optional[str] = None
    examples: Optional[str] = None
    tags: Optional[str] = None
    status: Optional[str] = None


class TestPatternResponse(BaseModel):
    id: int
    name: str
    category: str
    description: Optional[str] = None
    steps: Optional[str] = None
    expected_result: Optional[str] = None
    applicable_scenarios: Optional[str] = None
    examples: Optional[str] = None
    ai_score: float = 0.0
    usage_count: int = 0
    tags: Optional[str] = None
    status: str = "启用"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ============================
# Bug知识库
# ============================

class BugKnowledgeCreate(BaseModel):
    title: str
    module: Optional[str] = None
    severity: str
    root_cause: Optional[str] = None
    solution: Optional[str] = None
    symptoms: Optional[str] = None
    reproduction_steps: Optional[str] = None
    environment: Optional[str] = None
    tags: Optional[str] = None
    status: Optional[str] = "已解决"


class BugKnowledgeUpdate(BaseModel):
    title: Optional[str] = None
    module: Optional[str] = None
    severity: Optional[str] = None
    root_cause: Optional[str] = None
    solution: Optional[str] = None
    symptoms: Optional[str] = None
    reproduction_steps: Optional[str] = None
    environment: Optional[str] = None
    tags: Optional[str] = None
    status: Optional[str] = None


class BugKnowledgeResponse(BaseModel):
    id: int
    title: str
    module: Optional[str] = None
    severity: str
    root_cause: Optional[str] = None
    solution: Optional[str] = None
    symptoms: Optional[str] = None
    reproduction_steps: Optional[str] = None
    environment: Optional[str] = None
    tags: Optional[str] = None
    occurrence_count: int = 1
    status: str = "已解决"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ============================
# RAG搜索
# ============================

class KnowledgeSearchRequest(BaseModel):
    query: str
    search_type: Optional[str] = "all"  # all / test_pattern / bug_knowledge
    limit: Optional[int] = 10


class KnowledgeSearchResult(BaseModel):
    id: int
    type: str  # test_pattern / bug_knowledge
    title: str
    content: str
    relevance_score: float = 0.0
    metadata: Optional[dict] = None


class KnowledgeSearchResponse(BaseModel):
    query: str
    results: list[KnowledgeSearchResult]
    total: int
    response_time_ms: int = 0
