"""知识库 - 数据库模型"""

from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, Integer, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TestPattern(Base):
    """测试模式库"""
    __tablename__ = "test_patterns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="模式名称")
    category: Mapped[str] = mapped_column(String(50), nullable=False, comment="分类：功能测试/性能测试/安全测试/兼容性测试/自动化测试")
    description: Mapped[str] = mapped_column(Text, nullable=True, comment="模式描述")
    steps: Mapped[str] = mapped_column(Text, nullable=True, comment="执行步骤")
    expected_result: Mapped[str] = mapped_column(Text, nullable=True, comment="预期结果")
    applicable_scenarios: Mapped[str] = mapped_column(Text, nullable=True, comment="适用场景")
    examples: Mapped[str] = mapped_column(Text, nullable=True, comment="示例")
    ai_score: Mapped[float] = mapped_column(Float, default=0.0, comment="AI评分 0-100")
    usage_count: Mapped[int] = mapped_column(Integer, default=0, comment="使用次数")
    tags: Mapped[str] = mapped_column(String(500), nullable=True, comment="标签，逗号分隔")
    status: Mapped[str] = mapped_column(String(20), default="启用", comment="状态：启用/禁用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class BugKnowledge(Base):
    """Bug知识库"""
    __tablename__ = "bug_knowledge"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="Bug标题")
    module: Mapped[str] = mapped_column(String(100), nullable=True, comment="所属模块")
    severity: Mapped[str] = mapped_column(String(20), nullable=False, comment="严重程度：P0/P1/P2/P3")
    root_cause: Mapped[str] = mapped_column(Text, nullable=True, comment="根本原因")
    solution: Mapped[str] = mapped_column(Text, nullable=True, comment="解决方案")
    symptoms: Mapped[str] = mapped_column(Text, nullable=True, comment="症状描述")
    reproduction_steps: Mapped[str] = mapped_column(Text, nullable=True, comment="复现步骤")
    environment: Mapped[str] = mapped_column(String(200), nullable=True, comment="环境信息")
    tags: Mapped[str] = mapped_column(String(500), nullable=True, comment="标签，逗号分隔")
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1, comment="出现次数")
    status: Mapped[str] = mapped_column(String(20), default="已解决", comment="状态：已解决/待解决/已关闭")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class KnowledgeSearchLog(Base):
    """知识库搜索日志"""
    __tablename__ = "knowledge_search_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query: Mapped[str] = mapped_column(Text, nullable=False, comment="搜索关键词")
    result_type: Mapped[str] = mapped_column(String(50), nullable=True, comment="结果类型：test_pattern/bug_knowledge/combined")
    result_count: Mapped[int] = mapped_column(Integer, default=0, comment="结果数量")
    response_time_ms: Mapped[int] = mapped_column(Integer, default=0, comment="响应时间(毫秒)")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
