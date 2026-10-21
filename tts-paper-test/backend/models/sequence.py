"""序列执行调度 - 调度组数据模型"""

from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, Integer, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

from .base import TimestampMixin


class SequenceGroup(Base, TimestampMixin):
    """序列调度组：一次批量提交的多条生成序列（每条序列=一次完整 Pipeline）"""

    __tablename__ = "sequence_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False, comment="调度组名称")
    status: Mapped[str] = mapped_column(
        String(20), default="running", nullable=False, index=True,
        comment="running/completed/partial/failed/cancelled",
    )
    mode: Mapped[str] = mapped_column(
        String(20), default="serial", comment="serial=单任务串行(免费) / parallel=并行(付费)"
    )
    tier: Mapped[str] = mapped_column(String(20), default="free", comment="模型档位：free/paid")
    concurrency: Mapped[int] = mapped_column(Integer, default=1, comment="并发度=并行通道数")
    model: Mapped[str] = mapped_column(String(200), nullable=True, comment="执行使用的模型")
    simulated: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否为模拟执行(demo)")
    total_tasks: Mapped[int] = mapped_column(Integer, default=0, comment="任务总数")
    done_tasks: Mapped[int] = mapped_column(Integer, default=0, comment="成功任务数")
    failed_tasks: Mapped[int] = mapped_column(Integer, default=0, comment="失败任务数")
    tasks: Mapped[dict] = mapped_column(
        JSON, nullable=True,
        comment="任务快照: [{order, lane, name, content_preview, status, pipeline_record_id, duration, error, stages:[{key,label,status,duration}]}]",
    )
    total_duration: Mapped[float] = mapped_column(Float, nullable=True, comment="总耗时(秒)")
    requirement_content: Mapped[str] = mapped_column(Text, nullable=True, comment="兼容字段：单任务原文")
    project_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    version_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    created_by: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
