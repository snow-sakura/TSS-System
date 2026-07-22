"""操作日志模型"""

from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, Column, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class OperationLog(Base):
    """操作日志表"""
    __tablename__ = "operation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=True)
    username: Mapped[str] = mapped_column(String(50), nullable=True)
    module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(String(50), nullable=True)
    target_type: Mapped[str] = mapped_column(String(50), nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
