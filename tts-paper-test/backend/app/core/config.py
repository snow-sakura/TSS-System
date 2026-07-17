"""
TSS AI测试平台 — 全局配置
支持从环境变量 / .env 文件加载
数据库支持 MySQL + SQLite 双适配
"""

import os
from pathlib import Path
from typing import Optional, Literal

from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    # 应用
    APP_NAME: str = "TSS AI测试平台"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "tss-default-secret-key-change-in-production"

    # 数据库 — SQLite为默认(开发), MySQL为生产
    DATABASE_URL: str = "sqlite:///./tss_dev.db"
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 10

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """确保数据库URL有效"""
        valid_prefixes = ["sqlite://", "mysql+pymysql://", "mysql+aiomysql://"]
        if not any(v.startswith(prefix) for prefix in valid_prefixes):
            raise ValueError(
                f"数据库URL必须以 {valid_prefixes} 之一开头"
            )
        return v

    @property
    def DATABASE_IS_SQLITE(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite://")

    @property
    def DATABASE_IS_MYSQL(self) -> bool:
        return "mysql" in self.DATABASE_URL

    # JWT
    JWT_SECRET_KEY: str = "tss-jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # LLM
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    ANTHROPIC_API_KEY: Optional[str] = None

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # 日志
    LOG_LEVEL: str = "DEBUG"
    LOG_DIR: str = "./logs"

    # 存储
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # 验证码
    CAPTCHA_ENABLED: bool = True

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:8000"]

    # 速率限制
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# 日志目录
LOG_DIR_PATH = Path(settings.LOG_DIR)
LOG_DIR_PATH.mkdir(parents=True, exist_ok=True)

# 子日志目录
for sub_dir in ["app", "ai", "api", "auth", "operation", "audit"]:
    (LOG_DIR_PATH / sub_dir).mkdir(parents=True, exist_ok=True)

# 上传目录
UPLOAD_DIR_PATH = Path(settings.UPLOAD_DIR)
UPLOAD_DIR_PATH.mkdir(parents=True, exist_ok=True)
