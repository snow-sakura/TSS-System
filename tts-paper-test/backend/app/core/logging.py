"""
TSS AI测试平台 — 三层日志系统

第一层: 前端操作日志 → 写入 operation_logs 表 (API方式)
第二层: 后端终端日志 → structlog + Rich 彩色实时输出
第三层: 文件日志存储 → logs/ 按日期/类型分类，自动轮转

使用方式:
    from backend.app.core.logging import get_logger
    logger = get_logger("app")
    logger.info("系统启动", extra={"module": "main"})
    
    from backend.app.core.logging import log_operation
    log_operation(user_id="xxx", username="admin", action="create", 
                  resource_type="test_case", resource_id="xxx")
"""

import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from loguru import logger as loguru_logger
from rich.console import Console
from rich.logging import RichHandler
from rich.theme import Theme

from backend.app.core.config import settings, LOG_DIR_PATH

# ============================================================
# Rich 终端主题 (暖阳专业风配色)
# ============================================================

console_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "error": "bold red",
    "critical": "bold white on red",
    "success": "bold green",
    "debug": "dim white",
})

console = Console(theme=console_theme)

# ============================================================
# 第二层: 终端日志 — Rich Handler
# ============================================================

rich_handler = RichHandler(
    console=console,
    show_time=True,
    show_level=True,
    show_path=True,
    markup=True,
    rich_tracebacks=True,
    tracebacks_show_locals=True,
)

# ============================================================
# 第三层: 文件日志 — 按类型/日期分类，自动轮转
# ============================================================

class DailyRotatingFileHandler(logging.Handler):
    """按日期的文件日志处理器，支持按类型分类存储"""

    def __init__(self, log_type: str = "app", level=logging.DEBUG):
        super().__init__(level=level)
        self.log_type = log_type
        self.formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s | %(message)s"
        )

    def get_log_file(self) -> Path:
        """获取今天的日志文件路径"""
        today = datetime.now().strftime("%Y/%m/%d")
        log_dir = LOG_DIR_PATH / self.log_type / today
        log_dir.mkdir(parents=True, exist_ok=True)
        return log_dir / f"{self.log_type}.log"

    def emit(self, record: logging.LogRecord):
        try:
            log_file = self.get_log_file()
            with open(log_file, "a", encoding="utf-8") as f:
                msg = self.formatter.format(record)
                f.write(msg + "\n")
        except Exception:
            self.handleError(record)


# ============================================================
# Loguru 配置 — 结构化JSON日志
# ============================================================

def setup_loguru():
    """配置Loguru日志系统"""
    # 移除默认handler
    loguru_logger.remove()

    # 终端输出 (带颜色、格式化)
    loguru_logger.add(
        sys.stderr,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> "
            "[<level>{level:^8}</level>] "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> "
            "| <level>{message}</level>"
        ),
        level=settings.LOG_LEVEL,
        colorize=True,
        backtrace=True,
        diagnose=True,
    )

    # AI日志文件 — 详细记录Agent执行过程
    loguru_logger.add(
        str(LOG_DIR_PATH / "ai" / "ai_{time:YYYY-MM-DD}.log"),
        format="{time} [{level}] {name} | {message}",
        level="DEBUG",
        rotation="100 MB",
        retention="90 days",
        encoding="utf-8",
    )

    # 应用日志文件
    loguru_logger.add(
        str(LOG_DIR_PATH / "app" / "app_{time:YYYY-MM-DD}.log"),
        format="{time} [{level}] {name} | {message}",
        level="INFO",
        rotation="100 MB",
        retention="30 days",
        encoding="utf-8",
    )

    # 错误日志单独抽取
    loguru_logger.add(
        str(LOG_DIR_PATH / "app" / "error_{time:YYYY-MM-DD}.log"),
        format="{time} [{level}] {name}:{function}:{line} | {message}",
        level="ERROR",
        rotation="100 MB",
        retention="90 days",
        encoding="utf-8",
    )

    return loguru_logger


logger = setup_loguru()


def get_logger(name: str):
    """获取Logger实例，统一入口"""
    return logger.bind(name=name)


# ============================================================
# 第一层: 操作日志API (待集成到数据库)
# ============================================================

class OperationLogger:
    """操作日志记录器 — 同时写入数据库和文件"""

    @staticmethod
    def log(
        user_id: Optional[str],
        username: Optional[str],
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """
        记录操作日志
        
        Args:
            user_id: 用户ID
            username: 用户名
            action: 操作类型 (create/update/delete/approve/review/ai_generate/confirm/reject)
            resource_type: 资源类型 (requirement/test_point/test_case/defect/report...)
            resource_id: 资源ID
            details: 操作详情 (JSON)
            ip_address: 请求IP
            user_agent: User-Agent
        """
        # 终端实时打印
        action_icons = {
            "create": "➕", "update": "✏️", "delete": "🗑️",
            "approve": "✅", "reject": "❌", "review": "👁️",
            "ai_generate": "🤖", "confirm": "✔️", "login": "🔑",
            "logout": "🚪",
        }
        icon = action_icons.get(action, "📝")
        
        console.print(
            f"\n[bold cyan]╔═══ 操作日志 ═══╗[/bold cyan]"
            f"\n[bold]{icon} 操作:[/bold] {action}"
            f"\n[bold]👤 用户:[/bold] {username or 'anonymous'} (ID: {user_id or 'N/A'})"
            f"\n[bold]📦 资源:[/bold] {resource_type}/{resource_id or 'N/A'}"
            f"\n[bold]📋 详情:[/bold] {json.dumps(details or {}, ensure_ascii=False)}"
            f"\n[bold cyan]╚════════════════════╝[/bold cyan]"
        )

        # 写入操作日志文件
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "username": username,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details,
            "ip_address": ip_address,
            "user_agent": user_agent,
        }
        
        today = datetime.now().strftime("%Y/%m/%d")
        log_file = LOG_DIR_PATH / "operation" / today / "operation.log"
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")

        # 同时通过loguru记录
        logger.bind(name="operation").info(
            f"{action} | {resource_type}/{resource_id} | by {username}"
        )


# 便捷函数
log_operation = OperationLogger.log


# ============================================================
# FastAPI 中间件 — 请求日志
# ============================================================

async def log_request_middleware(request, call_next):
    """FastAPI中间件: 记录所有API请求"""
    import time
    
    start_time = time.time()
    
    # 请求信息
    method = request.method
    url = str(request.url.path)
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    
    logger.bind(name="api").info(
        f"➡️ {method} {url} | IP: {ip}"
    )
    
    # 处理请求
    response = await call_next(request)
    
    # 响应信息
    elapsed = time.time() - start_time
    status = response.status_code
    
    log_level = "SUCCESS" if status < 400 else "WARNING" if status < 500 else "ERROR"
    logger.bind(name="api").log(
        log_level,
        f"⬅️ {method} {url} | {status} | {elapsed:.3f}s"
    )
    
    # 写入API日志文件
    today = datetime.now().strftime("%Y/%m/%d")
    log_file = LOG_DIR_PATH / "api" / today / "api.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)
    
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "method": method,
        "url": url,
        "status": status,
        "elapsed_ms": round(elapsed * 1000, 2),
        "ip": ip,
        "user_agent": user_agent,
    }
    
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    
    return response
