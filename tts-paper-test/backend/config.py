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

    # AI - 默认模型配置（OpenCode Zen 免费模型，国内可访问）
    DEFAULT_LLM_PROVIDER: str = "openai"
    DEFAULT_LLM_MODEL: str = "hy3-free"
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://opencode.ai/zen/v1"

    # 文本模型（TEXT_* 为规范化命名，与 OPENAI_* 兼容层对齐）
    TEXT_PROVIDER: str = "openai"
    TEXT_API_KEY: str = ""
    TEXT_BASE_URL: str = "https://opencode.ai/zen/v1"
    TEXT_MODEL: str = "hy3-free"

    # 图像模型（Agnes AI，免费）
    IMAGE_PROVIDER: str = "agnes"
    IMAGE_API_KEY: str = ""
    IMAGE_MODEL: str = "agnes-image-2.0-flash"
    IMAGE_BASE_URL: str = "https://apihub.agnes-ai.com/v1"

    # 视频模型（Agnes AI，免费）
    VIDEO_PROVIDER: str = "agnes"
    VIDEO_API_KEY: str = ""
    VIDEO_MODEL: str = "agnes-video-v2.0"
    VIDEO_BASE_URL: str = "https://apihub.agnes-ai.com/v1"

    # 声音模型（TTS）
    TTS_ENGINE: str = "confucius4"
    TTS_VOICE: str = "confucius-feminine"
    TTS_API_URL: str = ""
    TTS_MODEL: str = "confucius4"

    # Mock 模式：auto=有Key用真、无Key自动mock | true=强制mock | false=强制真实
    MOCK_MODE: str = "auto"

    # Midscene.js（免费视觉模型待补充；DashScope 付费欠费已移除）
    MIDSCENE_MODEL_NAME: str = ""
    MIDSCENE_MODEL_API_KEY: str = ""
    MIDSCENE_MODEL_BASE_URL: str = ""
    MIDSCENE_MODEL_FAMILY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
