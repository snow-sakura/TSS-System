"""测试生命周期模型 - 需求分析→方案→测试点→用例→执行→缺陷→报告"""

from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, func, Column, Integer, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from .base import TimestampMixin


class Requirement(Base, TimestampMixin):
    """需求"""
    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)       # 用户手动输入或文档提取的原始内容
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)   # draft/pending/analyzing/analyzed/failed
    priority: Mapped[str] = mapped_column(String(10), default="P2", nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=True)       # manual / upload / ai_generated
    tags: Mapped[dict] = mapped_column(JSON, nullable=True)
    deadline: Mapped[str] = mapped_column(String(20), nullable=True)
    ai_analysis: Mapped[dict] = mapped_column(JSON, nullable=True)      # AI结构化分析结果 (JSON)
    ai_analysis_md: Mapped[str] = mapped_column(Text, nullable=True)    # AI分析Markdown完整输出

    # 全流程Pipeline关联
    pipeline_id: Mapped[str] = mapped_column(String(100), nullable=True, index=True)

    # 文档上传相关
    file_path: Mapped[str] = mapped_column(String(500), nullable=True)  # 上传文件存储路径
    file_type: Mapped[str] = mapped_column(String(20), nullable=True)   # 原始文件扩展名
    file_size: Mapped[int] = mapped_column(Integer, nullable=True)      # 文件大小(字节)
    parse_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending/parsing/parsed/failed
    parse_error: Mapped[str] = mapped_column(Text, nullable=True)       # 解析错误信息
    raw_content: Mapped[str] = mapped_column(Text, nullable=True)       # 文档提取的原始文本内容

    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class TestPlan(Base, TimestampMixin):
    """测试方案"""
    __tablename__ = "test_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(10), default="P2", nullable=False)
    scope: Mapped[str] = mapped_column(String(100), nullable=True)  # 测试范围
    risk_level: Mapped[str] = mapped_column(String(20), default="low")
    strategy: Mapped[dict] = mapped_column(JSON, nullable=True)  # 测试策略详情
    ai_suggestions: Mapped[dict] = mapped_column(JSON, nullable=True)  # AI建议
    requirement_ids: Mapped[dict] = mapped_column(JSON, nullable=True)  # 关联需求ID列表
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class TestPoint(Base, TimestampMixin):
    """测试点"""
    __tablename__ = "test_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(10), default="P2", nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=True)  # 分类
    coverage: Mapped[float] = mapped_column(Float, default=0.0)  # 覆盖率
    requirement_id: Mapped[int] = mapped_column(Integer, ForeignKey("requirements.id"), nullable=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("test_plans.id"), nullable=True)
    ai_extracted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class TestCase(Base, TimestampMixin):
    """测试用例"""
    __tablename__ = "lifecycle_test_cases"  # 避免与web_automation的web_test_cases冲突

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    preconditions: Mapped[str] = mapped_column(Text, nullable=True)
    steps: Mapped[dict] = mapped_column(JSON, nullable=False)
    expected_result: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(10), default="P2", nullable=False)
    test_type: Mapped[str] = mapped_column(String(50), nullable=True)  # 功能/性能/安全
    requirement_id: Mapped[int] = mapped_column(Integer, ForeignKey("requirements.id"), nullable=True)
    test_point_id: Mapped[int] = mapped_column(Integer, ForeignKey("test_points.id"), nullable=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("test_plans.id"), nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_model: Mapped[str] = mapped_column(String(100), nullable=True)
    reviewed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class TestExecution(Base, TimestampMixin):
    """测试执行"""
    __tablename__ = "lifecycle_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    test_type: Mapped[str] = mapped_column(String(50), nullable=True)
    environment: Mapped[str] = mapped_column(String(100), nullable=True)
    total_cases: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    blocked: Mapped[int] = mapped_column(Integer, default=0)
    pass_rate: Mapped[float] = mapped_column(Float, default=0.0)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    test_case_ids: Mapped[dict] = mapped_column(JSON, nullable=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("test_plans.id"), nullable=True)
    triggered_by: Mapped[str] = mapped_column(String(50), default="manual")  # manual, schedule, ci
    executed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    report_id: Mapped[int] = mapped_column(Integer, nullable=True)


class Defect(Base, TimestampMixin):
    """缺陷"""
    __tablename__ = "defects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new", nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="major", nullable=False)
    steps_to_reproduce: Mapped[dict] = mapped_column(JSON, nullable=True)
    actual_result: Mapped[str] = mapped_column(Text, nullable=True)
    expected_result: Mapped[str] = mapped_column(Text, nullable=True)
    environment: Mapped[str] = mapped_column(String(100), nullable=True)
    module: Mapped[str] = mapped_column(String(100), nullable=True)
    root_cause: Mapped[str] = mapped_column(Text, nullable=True)
    root_cause_ai: Mapped[dict] = mapped_column(JSON, nullable=True)  # AI根因分析
    screenshot_paths: Mapped[dict] = mapped_column(JSON, nullable=True)
    execution_id: Mapped[int] = mapped_column(Integer, ForeignKey("lifecycle_executions.id"), nullable=True)
    test_case_id: Mapped[int] = mapped_column(Integer, ForeignKey("lifecycle_test_cases.id"), nullable=True)
    assigned_to: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class Review(Base, TimestampMixin):
    """用例评审记录"""
    __tablename__ = "test_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=True)         # 评审内容
    review_type: Mapped[str] = mapped_column(String(50), nullable=True)  # 用例评审/方案评审/报告评审/AI自动评审
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=True)     # manual / ai
    reviewer: Mapped[str] = mapped_column(String(100), nullable=True)  # 评审人
    reviewer2: Mapped[str] = mapped_column(String(100), nullable=True) # 二次评审人
    case_count: Mapped[int] = mapped_column(Integer, default=0)        # 关联用例数
    passed_count: Mapped[int] = mapped_column(Integer, default=0)      # 通过数
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)    # 驳回数
    summary: Mapped[str] = mapped_column(Text, nullable=True)          # 评审摘要
    comments: Mapped[str] = mapped_column(Text, nullable=True)         # 评审意见
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    pipeline_id: Mapped[str] = mapped_column(String(100), nullable=True)
    stage_key: Mapped[str] = mapped_column(String(50), nullable=True)
    case_ids: Mapped[dict] = mapped_column(JSON, nullable=True)       # 关联用例ID
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class PipelineRecord(Base, TimestampMixin):
    """全流程流水线记录"""
    __tablename__ = "pipeline_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="running", nullable=False, index=True)
    pipeline_id: Mapped[str] = mapped_column(String(100), nullable=True)
    requirement_content: Mapped[str] = mapped_column(Text, nullable=True)
    requirement_name: Mapped[str] = mapped_column(String(500), nullable=True)
    total_duration: Mapped[float] = mapped_column(Float, nullable=True)
    stage_count: Mapped[int] = mapped_column(Integer, default=0)
    stage_results: Mapped[dict] = mapped_column(JSON, nullable=True)   # 各阶段执行结果
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class TestReport(Base, TimestampMixin):
    """测试报告"""
    __tablename__ = "test_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    report_type: Mapped[str] = mapped_column(String(50), nullable=True)  # version, regression, trend
    summary: Mapped[dict] = mapped_column(JSON, nullable=True)  # 汇总数据
    metrics: Mapped[dict] = mapped_column(JSON, nullable=True)  # 指标
    charts: Mapped[dict] = mapped_column(JSON, nullable=True)  # 图表数据
    ai_analysis: Mapped[dict] = mapped_column(JSON, nullable=True)  # AI分析结论
    conclusion: Mapped[str] = mapped_column(Text, nullable=True)
    recommendations: Mapped[dict] = mapped_column(JSON, nullable=True)
    execution_ids: Mapped[dict] = mapped_column(JSON, nullable=True)
    defect_ids: Mapped[dict] = mapped_column(JSON, nullable=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("test_plans.id"), nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
