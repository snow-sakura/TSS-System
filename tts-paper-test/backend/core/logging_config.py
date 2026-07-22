"""日志配置 - Loguru"""

import sys
from pathlib import Path
from loguru import logger

from config import get_settings

settings = get_settings()

LOG_DIR = Path(settings.LOG_DIR)
LOG_DIR.mkdir(parents=True, exist_ok=True)
(LOG_DIR / "agents").mkdir(exist_ok=True)


def setup_logging():
    """配置三层日志系统"""
    logger.remove()

    # 第一层: 终端彩色输出
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="DEBUG" if settings.DEBUG else "INFO",
        colorize=True,
    )

    # 第二层: 应用主日志 (轮转)
    logger.add(
        str(LOG_DIR / "app.log"),
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="INFO",
        rotation="10 MB",
        retention="30 days",
        compression="gz",
    )

    # 第三层: API请求日志
    logger.add(
        str(LOG_DIR / "api.log"),
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
        level="INFO",
        rotation="10 MB",
        retention="7 days",
        filter=lambda record: "api" in record["extra"].get("module", ""),
    )

    # 第四层: Agent操作日志
    logger.add(
        str(LOG_DIR / "agents" / "web_explorer.log"),
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
        level="DEBUG",
        rotation="5 MB",
        retention="14 days",
        filter=lambda record: record["extra"].get("module") == "web_explorer",
    )

    logger.add(
        str(LOG_DIR / "agents" / "test_generator.log"),
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
        level="DEBUG",
        rotation="5 MB",
        retention="14 days",
        filter=lambda record: record["extra"].get("module") == "test_generator",
    )

    # 第五层: 错误日志
    logger.add(
        str(LOG_DIR / "errors.log"),
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="ERROR",
        rotation="5 MB",
        retention="30 days",
    )

    return logger


# 模块化日志
def get_logger(module: str):
    """获取带模块标签的logger"""
    return logger.bind(module=module)
