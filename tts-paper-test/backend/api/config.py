"""基础配置 - API路由 (CRUD + 专属操作)"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.common import ResponseModel
from schemas.config import (
    EnvironmentCreate, EnvironmentUpdate, EnvironmentResponse,
    LLMProviderCreate, LLMProviderUpdate, LLMProviderResponse,
    PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateResponse,
    DeAIStyleCreate, DeAIStyleUpdate, DeAIStyleResponse,
    MCPServiceCreate, MCPServiceUpdate, MCPServiceResponse,
    SkillCreate, SkillUpdate, SkillResponse,
    HermesChannelCreate, HermesChannelUpdate, HermesChannelResponse,
    PromptTestRequest, DeAITestRequest, SkillExecuteRequest, HermesSendRequest,
)
from services import config_service as svc
from services.log_service import get_operation_logs

router = APIRouter(prefix="/api/v1/config", tags=["基础配置"])


def _page(model, items):
    """分页结果中的 items 批量转换"""
    return [model.model_validate(i) for i in items]


# ============================
# 环境配置 CRUD
# ============================

@router.get("/environments", response_model=ResponseModel)
async def list_environments(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    result = await svc.list_environments(db, page, page_size)
    result["items"] = _page(EnvironmentResponse, result["items"])
    return ResponseModel(data=result)

@router.get("/environments/{env_id}", response_model=ResponseModel)
async def get_environment(env_id: int, db: AsyncSession = Depends(get_db)):
    env = await svc.get_environment(db, env_id)
    if not env:
        return ResponseModel(success=False, message="环境不存在")
    return ResponseModel(data=EnvironmentResponse.model_validate(env))

@router.post("/environments", response_model=ResponseModel)
async def create_environment(data: EnvironmentCreate, db: AsyncSession = Depends(get_db)):
    env = await svc.create_environment(db, data)
    return ResponseModel(message="环境创建成功", data=EnvironmentResponse.model_validate(env))

@router.put("/environments/{env_id}", response_model=ResponseModel)
async def update_environment(env_id: int, data: EnvironmentUpdate, db: AsyncSession = Depends(get_db)):
    env = await svc.update_environment(db, env_id, data)
    if not env:
        return ResponseModel(success=False, message="环境不存在")
    return ResponseModel(message="环境更新成功", data=EnvironmentResponse.model_validate(env))

@router.delete("/environments/{env_id}", response_model=ResponseModel)
async def delete_environment(env_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_environment(db, env_id)
    if not ok:
        return ResponseModel(success=False, message="环境不存在")
    return ResponseModel(message="环境已删除")

@router.post("/environments/{env_id}/health-check", response_model=ResponseModel)
async def health_check_environment(env_id: int, db: AsyncSession = Depends(get_db)):
    env = await svc.health_check_environment(db, env_id)
    if not env:
        return ResponseModel(success=False, message="环境不存在")
    return ResponseModel(message=f"健康检测完成: {env.status}", data=EnvironmentResponse.model_validate(env))

@router.get("/environments/{env_id}/health-history", response_model=ResponseModel)
async def get_environment_health_history(env_id: int, limit: int = 10, db: AsyncSession = Depends(get_db)):
    items = await svc.list_health_history(db, target_type="environment", target_id=env_id, limit=limit)
    return ResponseModel(data={"items": items, "total": len(items)})

@router.post("/environments/batch-health-check", response_model=ResponseModel)
async def batch_health_check(db: AsyncSession = Depends(get_db)):
    result = await svc.batch_health_check(db)
    return ResponseModel(message=f"批量检测完成: {result['online']}/{result['total']} 在线", data=result)


# ============================
# 大模型配置 CRUD
# ============================

@router.get("/llm-providers", response_model=ResponseModel)
async def list_llm_providers(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    result = await svc.list_llm_providers(db, page, page_size)
    result["items"] = _page(LLMProviderResponse, result["items"])
    return ResponseModel(data=result)

@router.get("/llm-providers/{provider_id}", response_model=ResponseModel)
async def get_llm_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await svc.get_llm_provider(db, provider_id)
    if not provider:
        return ResponseModel(success=False, message="模型不存在")
    return ResponseModel(data=LLMProviderResponse.model_validate(provider))

@router.post("/llm-providers", response_model=ResponseModel)
async def create_llm_provider(data: LLMProviderCreate, db: AsyncSession = Depends(get_db)):
    provider = await svc.create_llm_provider(db, data)
    return ResponseModel(message="模型创建成功", data=LLMProviderResponse.model_validate(provider))

@router.put("/llm-providers/{provider_id}", response_model=ResponseModel)
async def update_llm_provider(provider_id: int, data: LLMProviderUpdate, db: AsyncSession = Depends(get_db)):
    provider = await svc.update_llm_provider(db, provider_id, data)
    if not provider:
        return ResponseModel(success=False, message="模型不存在")
    return ResponseModel(message="模型更新成功", data=LLMProviderResponse.model_validate(provider))

@router.delete("/llm-providers/{provider_id}", response_model=ResponseModel)
async def delete_llm_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_llm_provider(db, provider_id)
    if not ok:
        return ResponseModel(success=False, message="模型不存在")
    return ResponseModel(message="模型已删除")

@router.post("/llm-providers/{provider_id}/toggle", response_model=ResponseModel)
async def toggle_llm_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await svc.toggle_llm_provider(db, provider_id)
    if not provider:
        return ResponseModel(success=False, message="模型不存在")
    return ResponseModel(message=f"模型已{provider.status}", data=LLMProviderResponse.model_validate(provider))

@router.post("/llm-providers/{provider_id}/test", response_model=ResponseModel)
async def test_llm_connection(provider_id: int, db: AsyncSession = Depends(get_db)):
    result = await svc.test_llm_connection(db, provider_id)
    if not result:
        return ResponseModel(success=False, message="模型不存在")
    result["provider"] = LLMProviderResponse.model_validate(result["provider"])
    return ResponseModel(message=f"连接测试成功，延迟 {result['latency']}", data=result)


# ============================
# 提示词配置 CRUD
# ============================

@router.get("/prompts", response_model=ResponseModel)
async def list_prompts(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    result = await svc.list_prompts(db, page, page_size)
    result["items"] = _page(PromptTemplateResponse, result["items"])
    return ResponseModel(data=result)

@router.get("/prompts/{prompt_id}", response_model=ResponseModel)
async def get_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    prompt = await svc.get_prompt(db, prompt_id)
    if not prompt:
        return ResponseModel(success=False, message="模板不存在")
    return ResponseModel(data=PromptTemplateResponse.model_validate(prompt))

@router.post("/prompts", response_model=ResponseModel)
async def create_prompt(data: PromptTemplateCreate, db: AsyncSession = Depends(get_db)):
    prompt = await svc.create_prompt(db, data)
    return ResponseModel(message="提示词创建成功", data=PromptTemplateResponse.model_validate(prompt))

@router.put("/prompts/{prompt_id}", response_model=ResponseModel)
async def update_prompt(prompt_id: int, data: PromptTemplateUpdate, db: AsyncSession = Depends(get_db)):
    prompt = await svc.update_prompt(db, prompt_id, data)
    if not prompt:
        return ResponseModel(success=False, message="模板不存在")
    return ResponseModel(message="提示词更新成功", data=PromptTemplateResponse.model_validate(prompt))

@router.delete("/prompts/{prompt_id}", response_model=ResponseModel)
async def delete_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_prompt(db, prompt_id)
    if not ok:
        return ResponseModel(success=False, message="模板不存在")
    return ResponseModel(message="提示词已删除")

@router.post("/prompts/{prompt_id}/publish", response_model=ResponseModel)
async def publish_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    prompt = await svc.publish_prompt(db, prompt_id)
    if not prompt:
        return ResponseModel(success=False, message="模板不存在")
    return ResponseModel(message="提示词已发布", data=PromptTemplateResponse.model_validate(prompt))

@router.post("/prompts/{prompt_id}/test", response_model=ResponseModel)
async def test_prompt(prompt_id: int, body: PromptTestRequest, db: AsyncSession = Depends(get_db)):
    result = await svc.test_prompt(db, prompt_id, variables=body.variables, input_text=body.input_text)
    if not result:
        return ResponseModel(success=False, message="模板不存在")
    return ResponseModel(message="提示词测试完成", data=result)


# ============================
# 去AI味配置 CRUD
# ============================

@router.get("/deai-styles", response_model=ResponseModel)
async def list_deai_styles(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    result = await svc.list_deai_styles(db, page, page_size)
    result["items"] = _page(DeAIStyleResponse, result["items"])
    return ResponseModel(data=result)

@router.get("/deai-styles/{style_id}", response_model=ResponseModel)
async def get_deai_style(style_id: int, db: AsyncSession = Depends(get_db)):
    style = await svc.get_deai_style(db, style_id)
    if not style:
        return ResponseModel(success=False, message="策略不存在")
    return ResponseModel(data=DeAIStyleResponse.model_validate(style))

@router.post("/deai-styles", response_model=ResponseModel)
async def create_deai_style(data: DeAIStyleCreate, db: AsyncSession = Depends(get_db)):
    style = await svc.create_deai_style(db, data)
    return ResponseModel(message="策略创建成功", data=DeAIStyleResponse.model_validate(style))

@router.put("/deai-styles/{style_id}", response_model=ResponseModel)
async def update_deai_style(style_id: int, data: DeAIStyleUpdate, db: AsyncSession = Depends(get_db)):
    style = await svc.update_deai_style(db, style_id, data)
    if not style:
        return ResponseModel(success=False, message="策略不存在")
    return ResponseModel(message="策略更新成功", data=DeAIStyleResponse.model_validate(style))

@router.delete("/deai-styles/{style_id}", response_model=ResponseModel)
async def delete_deai_style(style_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_deai_style(db, style_id)
    if not ok:
        return ResponseModel(success=False, message="策略不存在")
    return ResponseModel(message="策略已删除")

@router.post("/deai-styles/{style_id}/test", response_model=ResponseModel)
async def test_deai_style(style_id: int, body: DeAITestRequest, db: AsyncSession = Depends(get_db)):
    result = await svc.test_deai_style(db, style_id, body.input_text)
    if not result:
        return ResponseModel(success=False, message="策略不存在")
    return ResponseModel(data=result)


# ============================
# MCP服务配置 CRUD
# ============================

@router.get("/mcp-services", response_model=ResponseModel)
async def list_mcp_services(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    result = await svc.list_mcp_services(db, page, page_size)
    result["items"] = _page(MCPServiceResponse, result["items"])
    return ResponseModel(data=result)

@router.get("/mcp-services/{service_id}", response_model=ResponseModel)
async def get_mcp_service(service_id: int, db: AsyncSession = Depends(get_db)):
    service = await svc.get_mcp_service(db, service_id)
    if not service:
        return ResponseModel(success=False, message="服务不存在")
    return ResponseModel(data=MCPServiceResponse.model_validate(service))

@router.post("/mcp-services", response_model=ResponseModel)
async def create_mcp_service(data: MCPServiceCreate, db: AsyncSession = Depends(get_db)):
    service = await svc.create_mcp_service(db, data)
    return ResponseModel(message="服务创建成功", data=MCPServiceResponse.model_validate(service))

@router.put("/mcp-services/{service_id}", response_model=ResponseModel)
async def update_mcp_service(service_id: int, data: MCPServiceUpdate, db: AsyncSession = Depends(get_db)):
    service = await svc.update_mcp_service(db, service_id, data)
    if not service:
        return ResponseModel(success=False, message="服务不存在")
    return ResponseModel(message="服务更新成功", data=MCPServiceResponse.model_validate(service))

@router.delete("/mcp-services/{service_id}", response_model=ResponseModel)
async def delete_mcp_service(service_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_mcp_service(db, service_id)
    if not ok:
        return ResponseModel(success=False, message="服务不存在")
    return ResponseModel(message="服务已删除")

@router.post("/mcp-services/{service_id}/test", response_model=ResponseModel)
async def test_mcp_connection(service_id: int, db: AsyncSession = Depends(get_db)):
    result = await svc.test_mcp_connection(db, service_id)
    if not result:
        return ResponseModel(success=False, message="服务不存在")
    status = "成功" if result["success"] else "失败"
    result["service"] = MCPServiceResponse.model_validate(result["service"])
    return ResponseModel(message=f"连通测试{status}", data=result)

@router.post("/mcp-services/batch-test", response_model=ResponseModel)
async def batch_test_mcp(db: AsyncSession = Depends(get_db)):
    result = await svc.batch_test_mcp(db)
    return ResponseModel(message=f"批量测试完成: {result['online']}/{result['total']} 在线", data=result)


# ============================
# Skills技能配置 CRUD
# ============================

@router.get("/skills", response_model=ResponseModel)
async def list_skills(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    result = await svc.list_skills(db, page, page_size)
    result["items"] = _page(SkillResponse, result["items"])
    return ResponseModel(data=result)

@router.get("/skills/{skill_id}", response_model=ResponseModel)
async def get_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    skill = await svc.get_skill(db, skill_id)
    if not skill:
        return ResponseModel(success=False, message="技能不存在")
    return ResponseModel(data=SkillResponse.model_validate(skill))

@router.post("/skills", response_model=ResponseModel)
async def create_skill(data: SkillCreate, db: AsyncSession = Depends(get_db)):
    skill = await svc.create_skill(db, data)
    return ResponseModel(message="技能创建成功", data=SkillResponse.model_validate(skill))

@router.put("/skills/{skill_id}", response_model=ResponseModel)
async def update_skill(skill_id: int, data: SkillUpdate, db: AsyncSession = Depends(get_db)):
    skill = await svc.update_skill(db, skill_id, data)
    if not skill:
        return ResponseModel(success=False, message="技能不存在")
    return ResponseModel(message="技能更新成功", data=SkillResponse.model_validate(skill))

@router.delete("/skills/{skill_id}", response_model=ResponseModel)
async def delete_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_skill(db, skill_id)
    if not ok:
        return ResponseModel(success=False, message="技能不存在")
    return ResponseModel(message="技能已删除")

@router.post("/skills/{skill_id}/toggle", response_model=ResponseModel)
async def toggle_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    skill = await svc.toggle_skill(db, skill_id)
    if not skill:
        return ResponseModel(success=False, message="技能不存在")
    return ResponseModel(message=f"技能已{skill.status}", data=SkillResponse.model_validate(skill))

@router.post("/skills/{skill_id}/execute", response_model=ResponseModel)
async def execute_skill(skill_id: int, body: SkillExecuteRequest, db: AsyncSession = Depends(get_db)):
    result = await svc.execute_skill(db, skill_id, params=body.params, input_text=body.input_text)
    if not result:
        return ResponseModel(success=False, message="技能不存在")
    return ResponseModel(message=f"技能执行完成", data=result)


# ============================
# Hermes渠道配置 CRUD
# ============================

@router.get("/hermes-channels", response_model=ResponseModel)
async def list_hermes_channels(page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    result = await svc.list_hermes_channels(db, page, page_size)
    result["items"] = _page(HermesChannelResponse, result["items"])
    return ResponseModel(data=result)

@router.get("/hermes-channels/{channel_id}", response_model=ResponseModel)
async def get_hermes_channel(channel_id: int, db: AsyncSession = Depends(get_db)):
    channel = await svc.get_hermes_channel(db, channel_id)
    if not channel:
        return ResponseModel(success=False, message="渠道不存在")
    return ResponseModel(data=HermesChannelResponse.model_validate(channel))

@router.post("/hermes-channels", response_model=ResponseModel)
async def create_hermes_channel(data: HermesChannelCreate, db: AsyncSession = Depends(get_db)):
    channel = await svc.create_hermes_channel(db, data)
    return ResponseModel(message="渠道创建成功", data=HermesChannelResponse.model_validate(channel))

@router.put("/hermes-channels/{channel_id}", response_model=ResponseModel)
async def update_hermes_channel(channel_id: int, data: HermesChannelUpdate, db: AsyncSession = Depends(get_db)):
    channel = await svc.update_hermes_channel(db, channel_id, data)
    if not channel:
        return ResponseModel(success=False, message="渠道不存在")
    return ResponseModel(message="渠道更新成功", data=HermesChannelResponse.model_validate(channel))

@router.delete("/hermes-channels/{channel_id}", response_model=ResponseModel)
async def delete_hermes_channel(channel_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_hermes_channel(db, channel_id)
    if not ok:
        return ResponseModel(success=False, message="渠道不存在")
    return ResponseModel(message="渠道已删除")

@router.post("/hermes-channels/{channel_id}/test", response_model=ResponseModel)
async def test_hermes_channel(channel_id: int, db: AsyncSession = Depends(get_db)):
    result = await svc.test_hermes_channel(db, channel_id)
    if not result:
        return ResponseModel(success=False, message="渠道不存在")
    status = "成功" if result["success"] else "失败"
    result["channel"] = HermesChannelResponse.model_validate(result["channel"])
    return ResponseModel(message=f"连通测试{status}", data=result)

@router.post("/hermes-channels/batch-test", response_model=ResponseModel)
async def batch_test_hermes(db: AsyncSession = Depends(get_db)):
    result = await svc.batch_test_hermes(db)
    return ResponseModel(message=f"批量测试完成: {result['online']}/{result['total']} 在线", data=result)


@router.post("/hermes-channels/{channel_id}/send", response_model=ResponseModel)
async def send_hermes_message(channel_id: int, body: HermesSendRequest, db: AsyncSession = Depends(get_db)):
    result = await svc.send_hermes_message(db, channel_id, body.message)
    if not result:
        return ResponseModel(success=False, message="渠道不存在")
    status = "成功" if result["success"] else "失败"
    return ResponseModel(message=f"消息发送{status}", data=result)


# ============================
# 健康检测历史 API
# ============================

@router.get("/health-history", response_model=ResponseModel)
async def get_health_history(
    target_type: str = None,
    target_id: int = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    items = await svc.list_health_history(db, target_type=target_type, target_id=target_id, limit=limit)
    return ResponseModel(data={"items": items, "total": len(items)})

# ============================
# LLM 使用统计 & 记录 API
# ============================

@router.get("/llm-usage-stats", response_model=ResponseModel)
async def get_llm_usage_stats(db: AsyncSession = Depends(get_db)):
    data = await svc.get_llm_usage_stats(db)
    return ResponseModel(data=data)


@router.get("/llm-usage-logs", response_model=ResponseModel)
async def list_llm_usage_logs(
    provider_id: int = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    result = await svc.list_llm_usage_logs(db, provider_id=provider_id, page=page, page_size=page_size)
    return ResponseModel(data=result)


# ============================
# 系统健康统计 API
# ============================

@router.get("/system-health-stats", response_model=ResponseModel)
async def get_system_health_stats(db: AsyncSession = Depends(get_db)):
    data = await svc.get_system_health_stats(db)
    return ResponseModel(data=data)


# ============================
# 操作日志 API
# ============================

@router.get("/operation-logs", response_model=ResponseModel)
async def list_operation_logs(
    page: int = 1,
    page_size: int = 20,
    module: str = None,
    db: AsyncSession = Depends(get_db),
):
    result = await get_operation_logs(db, module=module, page=page, page_size=page_size)
    # 将 ORM 对象转为 dict 便于序列化
    result["items"] = [
        {
            "id": i.id,
            "username": i.username,
            "module": i.module,
            "action": i.action,
            "target_id": i.target_id,
            "target_type": i.target_type,
            "detail": i.detail,
            "ip_address": i.ip_address,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in result["items"]
    ]
    return ResponseModel(data=result)
