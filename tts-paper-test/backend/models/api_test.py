"""AI接口自动化测试模型"""

from datetime import datetime
from sqlalchemy import (
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    func,
    Integer,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from .base import TimestampMixin


class ApiTestProject(Base, TimestampMixin):
    """接口测试项目"""

    __tablename__ = "api_test_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, index=True
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # 关系
    endpoints = relationship(
        "ApiEndpoint",
        back_populates="project",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    test_cases = relationship(
        "ApiTestCase",
        back_populates="project",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    executions = relationship(
        "ApiExecution",
        back_populates="project",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class ApiEnvironment(Base, TimestampMixin):
    """接口测试环境配置"""

    __tablename__ = "api_test_environments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    auth_type: Mapped[str] = mapped_column(String(50), default="无", nullable=False)
    auth_config: Mapped[dict] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="未连接", nullable=False, index=True
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )


class ApiEndpoint(Base, TimestampMixin):
    """接口端点"""

    __tablename__ = "api_endpoints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("api_test_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    method: Mapped[str] = mapped_column(String(10), default="GET", nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    headers: Mapped[dict] = mapped_column(JSON, nullable=True)
    params: Mapped[dict] = mapped_column(JSON, nullable=True)
    body: Mapped[dict] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="正常", nullable=False, index=True
    )
    response_time_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    last_checked_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    project = relationship("ApiTestProject", back_populates="endpoints")


class ApiTestCase(Base, TimestampMixin):
    """接口测试用例"""

    __tablename__ = "api_test_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("api_test_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    endpoint_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("api_endpoints.id", ondelete="SET NULL"), nullable=True
    )
    method: Mapped[str] = mapped_column(String(10), default="GET", nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    expected_status: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    priority: Mapped[str] = mapped_column(String(10), default="P1", nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="待执行", nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(20), default="手动", nullable=False)
    ai_model: Mapped[str] = mapped_column(String(100), nullable=True)
    last_result: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    project = relationship("ApiTestProject", back_populates="test_cases")


class ApiExecution(Base, TimestampMixin):
    """接口测试执行记录"""

    __tablename__ = "api_test_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("api_test_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # 执行关联的用例ID列表（一对多）
    case_ids: Mapped[dict] = mapped_column(JSON, nullable=True)
    total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pass_rate: Mapped[float] = mapped_column(Integer, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="执行中", nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    results: Mapped[dict] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    executed_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    project = relationship("ApiTestProject", back_populates="executions")


class ApiTestReport(Base, TimestampMixin):
    """接口测试报告"""

    __tablename__ = "api_test_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("api_test_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    report_type: Mapped[str] = mapped_column(
        String(50), default="回归报告", nullable=False
    )
    total_cases: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pass_rate: Mapped[float] = mapped_column(Integer, default=0.0, nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
