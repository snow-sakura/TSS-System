"""Data models for TSS Paper Test"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TestType(str, Enum):
    """Test type enumeration"""
    UNIT = "unit"
    API = "api"
    INTEGRATION = "integration"
    PERFORMANCE = "performance"
    PROPERTY = "property"


class TestStatus(str, Enum):
    """Test status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"


class TestResult(BaseModel):
    """Test result model"""
    test_id: str
    name: str
    type: TestType
    status: TestStatus
    duration: float = 0.0
    message: Optional[str] = None
    traceback: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)


class TestPlan(BaseModel):
    """Test plan model"""
    id: str
    name: str
    description: str
    test_types: List[TestType]
    priority: int = 1
    estimated_duration: float = 0.0
    test_cases: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TestSuite(BaseModel):
    """Test suite model"""
    id: str
    name: str
    description: str
    tests: List[TestResult] = Field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    @property
    def passed(self) -> int:
        return sum(1 for t in self.tests if t.status == TestStatus.PASSED)
    
    @property
    def failed(self) -> int:
        return sum(1 for t in self.tests if t.status == TestStatus.FAILED)
    
    @property
    def total(self) -> int:
        return len(self.tests)
    
    @property
    def pass_rate(self) -> float:
        return self.passed / self.total if self.total > 0 else 0.0


class BugKnowledge(BaseModel):
    """Bug knowledge model"""
    id: str
    title: str
    description: str
    severity: str  # low, medium, high, critical
    category: str
    symptoms: List[str]
    root_cause: Optional[str] = None
    fix_suggestion: Optional[str] = None
    related_tests: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TestPattern(BaseModel):
    """Test pattern model"""
    id: str
    name: str
    description: str
    category: str
    template: str
    examples: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentConfig(BaseModel):
    """Agent configuration model"""
    role: str
    goal: str
    backstory: str
    tools: List[str] = Field(default_factory=list)
    knowledge_sources: List[str] = Field(default_factory=list)
    verbose: bool = True
    reasoning: bool = False
    max_iter: int = 20
    max_retry_limit: int = 2
