"""Web自动化测试模型"""

from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, func, Column, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from .base import TimestampMixin


class WebAutomationProject(Base, TimestampMixin):
    """Web自动化项目"""
    __tablename__ = "web_automation_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_url: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="idle", nullable=False, index=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    # 关系
    pages = relationship("WebPage", back_populates="project", lazy="selectin", cascade="all, delete-orphan")
    test_cases = relationship("WebTestCase", back_populates="project", lazy="selectin", cascade="all, delete-orphan")
    executions = relationship("WebTestExecution", back_populates="project", lazy="selectin", cascade="all, delete-orphan")


class WebPage(Base):
    """探索到的页面"""
    __tablename__ = "web_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_automation_projects.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=True)
    page_map: Mapped[dict] = mapped_column(JSON, nullable=True)
    screenshot_path: Mapped[str] = mapped_column(Text, nullable=True)
    elements: Mapped[dict] = mapped_column(JSON, nullable=True)
    exploration_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    project = relationship("WebAutomationProject", back_populates="pages")


class WebTestCase(Base):
    """AI生成的测试用例"""
    __tablename__ = "web_test_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_automation_projects.id", ondelete="CASCADE"), nullable=False)
    page_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_pages.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    preconditions: Mapped[str] = mapped_column(Text, nullable=True)
    steps: Mapped[dict] = mapped_column(JSON, nullable=False)
    expected_result: Mapped[str] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default="P2", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ai_model: Mapped[str] = mapped_column(String(100), nullable=True)
    review_note: Mapped[str] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    project = relationship("WebAutomationProject", back_populates="test_cases")


class WebTestExecution(Base):
    """测试执行记录"""
    __tablename__ = "web_test_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_automation_projects.id", ondelete="CASCADE"), nullable=False)
    test_case_id: Mapped[int] = mapped_column(Integer, ForeignKey("web_test_cases.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    screenshots: Mapped[dict] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    ai_analysis: Mapped[str] = mapped_column(Text, nullable=True)
    executed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    project = relationship("WebAutomationProject", back_populates="executions")


class AIDraft(Base):
    """AI草稿 - 通用"""
    __tablename__ = "ai_drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=True)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    ai_model: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
