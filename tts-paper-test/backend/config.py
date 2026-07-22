"""TSS AI测试平台 - 配置管理"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """应用配置"""

    # 应用
    APP_NAME: str = "TSS AI测试平台"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # 数据库
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR / 'tss_dev.db'}"

    # JWT
    SECRET_KEY: str = "tss-ai-test-platform-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # 日志
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = str(BASE_DIR / "logs")

    # AI - 默认模型配置
    DEFAULT_LLM_PROVIDER: str = "openai"
    DEFAULT_LLM_MODEL: str = "gpt-4o"
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # Midscene.js
    MIDSCENE_MODEL_NAME: str = "qwen3.7-plus"
    MIDSCENE_MODEL_API_KEY: str = ""
    MIDSCENE_MODEL_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    MIDSCENE_MODEL_FAMILY: str = "qwen3"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
