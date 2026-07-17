"""
TSS AI测试平台 — 数据库配置
支持 MySQL + SQLite 双适配
SQLAlchemy 2.0 async/sync 双模式
"""

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import create_engine, DateTime, TypeDecorator
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.core.config import settings


# ============================================================
# 数据库引擎 — 根据配置自动选择MySQL或SQLite
# ============================================================

def get_engine():
    """创建数据库引擎，自动适配 MySQL / SQLite"""
    db_url = settings.DATABASE_URL

    connect_args = {}
    if settings.DATABASE_IS_SQLITE:
        # SQLite 专用配置
        connect_args["check_same_thread"] = False
        return create_engine(
            db_url,
            echo=settings.DATABASE_ECHO,
            connect_args=connect_args,
            poolclass=StaticPool,
        )
    else:
        # MySQL 配置
        return create_engine(
            db_url,
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=20,
            pool_pre_ping=True,
        )


engine = get_engine()

# SessionLocal — 每个请求创建独立session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ============================================================
# 公共基类
# ============================================================

class Base(DeclarativeBase):
    """所有模型的基类，统一JSON序列化"""

    def to_dict(self) -> dict[str, Any]:
        """将模型转为字典，自动处理特殊类型"""
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                result[column.name] = value.isoformat()
            elif isinstance(value, (dict, list)):
                result[column.name] = json.dumps(value, ensure_ascii=False)
            else:
                result[column.name] = value
        return result

    def __repr__(self) -> str:
        """可读性表示"""
        pk = ", ".join(
            f"{c.name}={getattr(self, c.name)}"
            for c in self.__table__.primary_key.columns
        )
        return f"<{self.__class__.__name__}({pk})>"


# ============================================================
# 数据库依赖 — FastAPI注入
# ============================================================

def get_db() -> Session:
    """获取数据库session (FastAPI依赖注入)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# 自定义字段类型 — 兼容MySQL JSON 和 SQLite TEXT
# ============================================================

class JSONField(TypeDecorator):
    """JSON字段：MySQL使用原生JSON，SQLite使用TEXT"""

    impl = None  # 运行时确定

    def __init__(self):
        if settings.DATABASE_IS_MYSQL:
            from sqlalchemy import JSON
            self.impl = JSON
        else:
            from sqlalchemy import Text
            self.impl = Text
        super().__init__()

    def process_bind_param(self, value: Any, dialect) -> Optional[str]:
        if value is None:
            return None
        return json.dumps(value, ensure_ascii=False)

    def process_result_value(self, value: Optional[str], dialect) -> Any:
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return value  # MySQL JSON已解析
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
