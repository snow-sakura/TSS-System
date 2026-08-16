"""AI 通用测试任务模型

覆盖 AI 自动化中心的 5 个类型（性能/安全/兼容/回归/探索），
每个类型下的 5 个子页面共享一张表，通过 task_type + module 区分。
config 存各页面配置字段，result 存执行结果。
"""

from sqlalchemy import Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base
from .base import TimestampMixin


class TestTask(Base, TimestampMixin):
    """通用测试任务"""

    __tablename__ = "ai_test_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 任务类型：performance / security / compatibility / regression / exploratory
    task_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # 子页面模块 key：如 perf-scenario / sec-targets / compat-matrix ...
    module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    # 各类型配置：url / concurrency / duration / browsers / rules ...
    config: Mapped[dict] = mapped_column(JSON, nullable=True)
    # 状态：待执行 / 执行中 / 完成 / 失败
    status: Mapped[str] = mapped_column(
        String(20), default="待执行", nullable=False, index=True
    )
    # 执行结果：summary + items
    result: Mapped[dict] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
