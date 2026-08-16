"""数据工厂模型

记录每次数据生成历史：生成器、数量、参数与前几条预览。
"""

from sqlalchemy import Integer, String, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base
from .base import TimestampMixin


class DataFactoryLog(Base, TimestampMixin):
    """数据生成记录"""

    __tablename__ = "data_factory_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    generator: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 生成器 key
    generator_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # 生成器中文名
    count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    params: Mapped[dict] = mapped_column(JSON, nullable=True)
    preview: Mapped[dict] = mapped_column(JSON, nullable=True)  # 前 5 条预览
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
