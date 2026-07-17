"""
TSS AI测试平台 — 所有数据库模型
用户 / 需求 / 测试点 / 测试方案 / 测试用例 / 缺陷 / 报告 / 环境 / AI生成记录 / 操作日志
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================
# 用户模型
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(128), nullable=False)
    display_name = Column(String(50), default="")
    avatar_url = Column(String(200), default="")
    role = Column(String(20), default="test_engineer")  # admin / test_manager / test_engineer / viewer
    status = Column(String(20), default="active")       # active / inactive / locked
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ============================================================
# 需求管理
# ============================================================

class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    doc_type = Column(String(20), default="text")       # text / markdown / docx / pdf
    status = Column(String(20), default="pending")       # pending / analyzing / analyzed / approved / rejected
    ai_analysis = Column(JSON, nullable=True)            # AI分析结果
    version = Column(Integer, default=1)
    created_by = Column(String(36), nullable=True)
    approved_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    test_points = relationship("TestPoint", back_populates="requirement", cascade="all, delete-orphan")


# ============================================================
# 测试点管理
# ============================================================

class TestPoint(Base):
    __tablename__ = "test_points"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    requirement_id = Column(String(36), ForeignKey("requirements.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    type = Column(String(30), default="functional")       # functional / performance / security / ui / api
    priority = Column(String(10), default="medium")       # critical / high / medium / low
    category = Column(String(50), default="")
    status = Column(String(20), default="draft")          # draft / active / covered / obsolete
    ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    requirement = relationship("Requirement", back_populates="test_points")
    test_cases = relationship("TestCase", back_populates="test_point", cascade="all, delete-orphan")


# ============================================================
# 测试方案
# ============================================================

class TestPlan(Base):
    __tablename__ = "test_plans"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="draft")          # draft / active / completed / archived
    ai_suggestion = Column(JSON, nullable=True)
    requirement_ids = Column(JSON, default=list)          # 关联需求ID列表
    test_point_ids = Column(JSON, default=list)           # 关联测试点ID列表
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    test_cases = relationship("TestCase", back_populates="plan", cascade="all, delete-orphan")
    executions = relationship("TestExecution", back_populates="plan", cascade="all, delete-orphan")


# ============================================================
# 测试用例
# ============================================================

class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    plan_id = Column(String(36), ForeignKey("test_plans.id"), nullable=True, index=True)
    test_point_id = Column(String(36), ForeignKey("test_points.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    precondition = Column(Text, default="")
    steps = Column(JSON, default=list)                    # [{"step":1,"action":"","expected":""},...]
    expected_result = Column(Text, default="")
    actual_result = Column(Text, default="")
    status = Column(String(20), default="draft")          # draft / approved / failed / passed / blocked
    priority = Column(String(5), default="p2")            # p0 / p1 / p2 / p3
    type = Column(String(30), default="functional")
    ai_generated = Column(Boolean, default=False)
    reviewed_by = Column(String(36), nullable=True)
    confirmed_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    plan = relationship("TestPlan", back_populates="test_cases")
    test_point = relationship("TestPoint", back_populates="test_cases")
    defects = relationship("Defect", back_populates="test_case", cascade="all, delete-orphan")


# ============================================================
# 测试执行
# ============================================================

class TestExecution(Base):
    __tablename__ = "test_executions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    plan_id = Column(String(36), ForeignKey("test_plans.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    status = Column(String(20), default="pending")        # pending / running / passed / failed / blocked
    total_cases = Column(Integer, default=0)
    passed_cases = Column(Integer, default=0)
    failed_cases = Column(Integer, default=0)
    blocked_cases = Column(Integer, default=0)
    environment = Column(String(50), default="")
    executed_by = Column(String(36), nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    plan = relationship("TestPlan", back_populates="executions")


# ============================================================
# 缺陷管理
# ============================================================

class Defect(Base):
    __tablename__ = "defects"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    severity = Column(String(10), default="major")        # critical / major / minor / trivial
    priority = Column(String(10), default="medium")       # urgent / high / medium / low
    status = Column(String(20), default="new")            # new / confirmed / in_progress / resolved / closed
    root_cause = Column(Text, default="")
    solution = Column(Text, default="")
    test_case_id = Column(String(36), ForeignKey("test_cases.id"), nullable=True)
    ai_analysis = Column(JSON, nullable=True)
    assigned_to = Column(String(36), nullable=True)
    created_by = Column(String(36), nullable=True)
    resolved_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    test_case = relationship("TestCase", back_populates="defects")


# ============================================================
# 测试报告
# ============================================================

class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    report_type = Column(String(20), default="execution")  # execution / summary / custom
    status = Column(String(20), default="draft")           # draft / published / archived
    content = Column(JSON, default=dict)                   # 报告内容(结构化JSON)
    ai_generated = Column(Boolean, default=False)
    execution_id = Column(String(36), nullable=True)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ============================================================
# 测试环境
# ============================================================

class Environment(Base):
    __tablename__ = "environments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    env_type = Column(String(20), default="test")         # test / staging / production
    config = Column(JSON, default=dict)                   # 环境配置(URL/DB/Token等)
    status = Column(String(20), default="active")         # active / inactive / maintenance
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ============================================================
# LLM配置
# ============================================================

class LLMProvider(Base):
    __tablename__ = "llm_providers"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    provider_type = Column(String(30), default="openai")  # openai / anthropic / ollama / custom
    api_base = Column(String(200), default="")
    api_key = Column(String(200), default="")
    model_name = Column(String(100), default="gpt-4o")
    config = Column(JSON, default=dict)                   # 额外配置
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ============================================================
# MCP服务配置
# ============================================================

class MCPService(Base):
    __tablename__ = "mcp_services"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    service_type = Column(String(30), default="tool")     # tool / resource / prompt
    endpoint = Column(String(200), default="")
    config = Column(JSON, default=dict)
    status = Column(String(20), default="inactive")       # active / inactive / error
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ============================================================
# 系统参数
# ============================================================

class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)
    description = Column(String(200), default="")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ============================================================
# 操作日志
# ============================================================

class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), nullable=True, index=True)
    username = Column(String(50), default="")
    action = Column(String(50), nullable=False)           # create / update / delete / login / ai_generate / etc
    resource_type = Column(String(30), nullable=False)    # requirement / test_case / defect / etc
    resource_id = Column(String(36), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), default="")
    user_agent = Column(String(200), default="")
    status = Column(String(10), default="success")        # success / failure
    duration_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow, index=True)


# ============================================================
# AI生成记录
# ============================================================

class AIGeneration(Base):
    __tablename__ = "ai_generations"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    agent_type = Column(String(30), nullable=False)       # requirement_analyzer / test_point_extractor / case_generator / etc
    resource_type = Column(String(30), nullable=False)
    resource_id = Column(String(36), nullable=True)
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, default=dict)
    status = Column(String(20), default="draft")          # draft / reviewed / confirmed / rejected
    reviewed_by = Column(String(36), nullable=True)
    confirmed_by = Column(String(36), nullable=True)
    model_used = Column(String(50), default="")
    token_usage = Column(JSON, nullable=True)              # {"prompt": 100, "completion": 50, "total": 150}
    duration_ms = Column(Integer, default=0)
    feedback_score = Column(Integer, nullable=True)       # 1-5
    created_at = Column(DateTime, default=utcnow)


# ============================================================
# 提示词管理
# ============================================================

class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, default="")
    category = Column(String(30), default="general")      # general / requirement / test_point / test_case / defect / report
    content = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    variables = Column(JSON, default=list)                 # 模板变量列表
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
