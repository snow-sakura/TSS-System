"""设备管理 - 数据库模型"""

from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class UserDevice(Base):
    """用户设备表"""
    __tablename__ = "user_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="用户ID")
    username: Mapped[str] = mapped_column(String(100), nullable=False, comment="用户名（冗余）")
    device_name: Mapped[str] = mapped_column(String(200), nullable=False, comment="设备名称")
    os: Mapped[str] = mapped_column(String(100), nullable=True, comment="操作系统")
    browser: Mapped[str] = mapped_column(String(100), nullable=True, comment="浏览器")
    user_agent: Mapped[str] = mapped_column(Text, nullable=True, comment="完整 UA")
    ip_address: Mapped[str] = mapped_column(String(50), nullable=True, comment="IP地址")
    fingerprint: Mapped[str] = mapped_column(String(100), nullable=True, comment="设备指纹")
    status: Mapped[str] = mapped_column(String(20), default="未验证", comment="状态: 可信/未验证/已封禁")
    last_active_at: Mapped[datetime] = mapped_column(DateTime, nullable=True, comment="最后活跃时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
