"""
TSS AI测试平台 — FastAPI 应用入口
"""

import sys
from pathlib import Path

# 确保项目根目录在Python路径中
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.app.core.config import settings
from backend.app.core.logging import logger, log_request_middleware, get_logger
from backend.app.core.database import engine, Base
from backend.app.api.v1 import api_v1


# ============================================================
# 应用生命周期
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    log = get_logger("main")
    log.info("╔══════════════════════════════════════════════╗")
    log.info(f"║  {settings.APP_NAME} v{settings.APP_VERSION} 启动")
    log.info(f"║  数据库: {settings.DATABASE_URL[:30]}...")
    log.info(f"║  日志目录: {settings.LOG_DIR}")
    log.info(f"║  调试模式: {settings.DEBUG}")
    log.info("╚══════════════════════════════════════════════╝")

    # 创建所有表 (SQLite开发环境自动创建)
    if settings.DATABASE_IS_SQLITE:
        Base.metadata.create_all(bind=engine)
        log.info("✅ 数据库表已自动创建 (SQLite)")

    yield

    log.info("🛑 应用关闭中...")


# ============================================================
# FastAPI 实例
# ============================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI驱动的全生命周期测试管理平台",
    lifespan=lifespan,
)

# ============================================================
# 中间件
# ============================================================

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 速率限制
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ============================================================
# 请求日志中间件 (必须放在路由之后)
# ============================================================

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    return await log_request_middleware(request, call_next)


# ============================================================
# 根路由
# ============================================================

# ============================================================
# 注册API路由
# ============================================================

app.include_router(api_v1)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "timestamp": __import__("datetime").datetime.now().isoformat(),
    }


# ============================================================
# 统一异常处理
# ============================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理"""
    logger.bind(name="app").error(
        f"未捕获异常: {exc} | URL: {request.method} {request.url.path}"
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请联系管理员"},
    )


# ============================================================
# 启动入口
# ============================================================

if __name__ == "__main__":
    import uvicorn
    
    log = get_logger("main")
    log.info(f"🚀 启动 {settings.APP_NAME}...")
    log.info(f"📡 API文档: http://localhost:8000/docs")
    log.info(f"📋 OpenAPI: http://localhost:8000/openapi.json")
    
    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
