"""
TSS AI测试平台 — 配置模块 API路由 (环境/LLM/MCP/系统参数)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import Environment, LLMProvider, MCPService, SystemConfig
from backend.app.schemas.schemas import (
    EnvironmentCreate, EnvironmentUpdate, EnvironmentOut,
    LLMProviderCreate, LLMProviderOut,
    MCPServiceCreate, MCPServiceOut,
    ApiResponse, PaginatedResponse,
)


# ============================================================
# 环境配置
# ============================================================

env_router = APIRouter(prefix="/environments", tags=["环境配置"])


@env_router.get("", response_model=ApiResponse)
def list_environments(db: Session = Depends(get_db)):
    items = db.query(Environment).order_by(Environment.created_at.desc()).all()
    return ApiResponse(data=[EnvironmentOut.model_validate(i).model_dump() for i in items])


@env_router.post("", response_model=ApiResponse)
def create_environment(req: EnvironmentCreate, db: Session = Depends(get_db)):
    env = Environment(**req.model_dump())
    db.add(env)
    db.commit()
    db.refresh(env)
    return ApiResponse(code=201, data=EnvironmentOut.model_validate(env).model_dump())


@env_router.put("/{env_id}", response_model=ApiResponse)
def update_environment(env_id: str, req: EnvironmentUpdate, db: Session = Depends(get_db)):
    env = db.query(Environment).filter(Environment.id == env_id).first()
    if not env:
        raise HTTPException(status_code=404, detail="环境不存在")
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(env, k, v)
    db.commit()
    return ApiResponse(data=EnvironmentOut.model_validate(env).model_dump())


@env_router.delete("/{env_id}", response_model=ApiResponse)
def delete_environment(env_id: str, db: Session = Depends(get_db)):
    env = db.query(Environment).filter(Environment.id == env_id).first()
    if not env:
        raise HTTPException(status_code=404, detail="环境不存在")
    db.delete(env)
    db.commit()
    return ApiResponse(message="删除成功")


# ============================================================
# LLM提供商
# ============================================================

llm_router = APIRouter(prefix="/llm", tags=["LLM配置"])


@llm_router.get("/providers", response_model=ApiResponse)
def list_llm_providers(db: Session = Depends(get_db)):
    items = db.query(LLMProvider).order_by(LLMProvider.created_at.desc()).all()
    return ApiResponse(data=[LLMProviderOut.model_validate(i).model_dump() for i in items])


@llm_router.post("/providers", response_model=ApiResponse)
def create_llm_provider(req: LLMProviderCreate, db: Session = Depends(get_db)):
    provider = LLMProvider(**req.model_dump())
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return ApiResponse(code=201, data=LLMProviderOut.model_validate(provider).model_dump())


@llm_router.put("/providers/{provider_id}", response_model=ApiResponse)
def update_llm_provider(provider_id: str, req: LLMProviderCreate, db: Session = Depends(get_db)):
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="提供商不存在")
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(provider, k, v)
    db.commit()
    return ApiResponse(data=LLMProviderOut.model_validate(provider).model_dump())


@llm_router.delete("/providers/{provider_id}", response_model=ApiResponse)
def delete_llm_provider(provider_id: str, db: Session = Depends(get_db)):
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="提供商不存在")
    db.delete(provider)
    db.commit()
    return ApiResponse(message="删除成功")


@llm_router.post("/providers/{provider_id}/test", response_model=ApiResponse)
def test_llm_provider(provider_id: str, db: Session = Depends(get_db)):
    """测试LLM连接"""
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="提供商不存在")
    # TODO: 实际连接测试
    return ApiResponse(message="连接测试功能开发中")


# ============================================================
# MCP服务
# ============================================================

mcp_router = APIRouter(prefix="/mcp", tags=["MCP服务"])


@mcp_router.get("/services", response_model=ApiResponse)
def list_mcp_services(db: Session = Depends(get_db)):
    items = db.query(MCPService).order_by(MCPService.created_at.desc()).all()
    return ApiResponse(data=[MCPServiceOut.model_validate(i).model_dump() for i in items])


@mcp_router.post("/services", response_model=ApiResponse)
def create_mcp_service(req: MCPServiceCreate, db: Session = Depends(get_db)):
    svc = MCPService(**req.model_dump())
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return ApiResponse(code=201, data=MCPServiceOut.model_validate(svc).model_dump())


@mcp_router.put("/services/{svc_id}", response_model=ApiResponse)
def update_mcp_service(svc_id: str, req: MCPServiceCreate, db: Session = Depends(get_db)):
    svc = db.query(MCPService).filter(MCPService.id == svc_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="服务不存在")
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(svc, k, v)
    db.commit()
    return ApiResponse(data=MCPServiceOut.model_validate(svc).model_dump())


@mcp_router.delete("/services/{svc_id}", response_model=ApiResponse)
def delete_mcp_service(svc_id: str, db: Session = Depends(get_db)):
    svc = db.query(MCPService).filter(MCPService.id == svc_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="服务不存在")
    db.delete(svc)
    db.commit()
    return ApiResponse(message="删除成功")


@mcp_router.post("/services/{svc_id}/test", response_model=ApiResponse)
def test_mcp_service(svc_id: str, db: Session = Depends(get_db)):
    svc = db.query(MCPService).filter(MCPService.id == svc_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="服务不存在")
    # TODO: 实际连接测试
    return ApiResponse(message="连接测试功能开发中")
