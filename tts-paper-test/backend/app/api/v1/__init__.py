"""
TSS AI测试平台 — API v1 路由注册
"""

from fastapi import APIRouter

from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.requirements import router as requirements_router
from backend.app.api.v1.test_points import router as test_points_router
from backend.app.api.v1.test_plans import router as test_plans_router
from backend.app.api.v1.test_cases import router as test_cases_router
from backend.app.api.v1.executions import router as executions_router
from backend.app.api.v1.defects import router as defects_router
from backend.app.api.v1.reports import router as reports_router
from backend.app.api.v1.config import env_router, llm_router, mcp_router
from backend.app.api.v1.personal import user_router, log_router

api_v1 = APIRouter(prefix="/api/v1")

# 认证
api_v1.include_router(auth_router)

# 测试基础
api_v1.include_router(requirements_router)
api_v1.include_router(test_points_router)
api_v1.include_router(test_plans_router)
api_v1.include_router(test_cases_router)
api_v1.include_router(executions_router)
api_v1.include_router(defects_router)
api_v1.include_router(reports_router)

# 基础配置
api_v1.include_router(env_router)
api_v1.include_router(llm_router)
api_v1.include_router(mcp_router)

# 个人中心
api_v1.include_router(user_router)
api_v1.include_router(log_router)
