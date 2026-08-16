"""AI App 自动化测试模型

对应 AI 自动化中心 App 类型下 5 个子页面：
设备管理 / 测试用例 / 远程执行 / 截图对比 / 崩溃分析
"""

from sqlalchemy import Integer, String, Text, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base
from .base import TimestampMixin


class AppDevice(Base, TimestampMixin):
    """App 测试设备（设备管理）"""

    __tablename__ = "app_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    os: Mapped[str] = mapped_column(String(50), default="Android", nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="空闲", nullable=False, index=True
    )  # 空闲 / 占用 / 离线
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )


class AppTestCase(Base, TimestampMixin):
    """App 测试用例（测试用例）"""

    __tablename__ = "app_test_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    platform: Mapped[str] = mapped_column(
        String(20), default="Android", nullable=False
    )  # Android / iOS
    priority: Mapped[str] = mapped_column(String(10), default="P1", nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="待执行", nullable=False, index=True
    )  # 待执行 / 通过 / 失败
    source: Mapped[str] = mapped_column(
        String(20), default="手动", nullable=False
    )  # 手动 / AI生成
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )


class AppExecution(Base, TimestampMixin):
    """App 远程执行记录（远程执行）"""

    __tablename__ = "app_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    device: Mapped[str] = mapped_column(String(100), nullable=True)
    cases_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pass_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="待执行", nullable=False, index=True
    )  # 待执行 / 执行中 / 完成 / 失败
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    result: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )


class AppScreenshotDiff(Base, TimestampMixin):
    """App 截图对比记录（截图对比）"""

    __tablename__ = "app_screenshot_diffs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    page: Mapped[str] = mapped_column(String(200), nullable=False)
    device: Mapped[str] = mapped_column(String(100), nullable=True)
    result: Mapped[str] = mapped_column(
        String(20), default="一致", nullable=False
    )  # 一致 / 差异
    similarity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )


class AppCrashLog(Base, TimestampMixin):
    """App 崩溃日志（崩溃分析）"""

    __tablename__ = "app_crash_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crash_type: Mapped[str] = mapped_column(String(100), nullable=False)  # 崩溃类型
    device: Mapped[str] = mapped_column(String(100), nullable=True)
    count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="待分析", nullable=False, index=True
    )  # 待分析 / 分析中 / 已修复
    detail: Mapped[str] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
