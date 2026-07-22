"""基础配置 - Pydantic Schemas"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


# ====== 环境配置 ======
class EnvironmentBase(BaseModel):
    name: str
    url: str
    db_url: Optional[str] = None
    redis_url: Optional[str] = None
    description: Optional[str] = None

class EnvironmentCreate(EnvironmentBase): pass

class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    db_url: Optional[str] = None
    redis_url: Optional[str] = None
    description: Optional[str] = None

class EnvironmentResponse(EnvironmentBase):
    id: int
    status: str
    api_version: Optional[str] = None
    last_check_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ====== 大模型配置 ======
class LLMProviderBase(BaseModel):
    name: str
    model: str
    api_key: str
    base_url: Optional[str] = None
    type: str = "Chat模型"
    max_tokens: int = 128000
    temperature: float = 0.7

class LLMProviderCreate(LLMProviderBase): pass

class LLMProviderUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    type: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None

class LLMProviderResponse(LLMProviderBase):
    id: int
    status: str
    calls_today: int
    avg_latency: str
    cost_today: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ====== 提示词配置 ======
class PromptTemplateBase(BaseModel):
    name: str
    content: str
    category: str = "通用"
    version: str = "v1.0"
    description: Optional[str] = None
    variables: Optional[dict] = None

class PromptTemplateCreate(PromptTemplateBase): pass

class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[dict] = None
    status: Optional[str] = None

class PromptTemplateResponse(PromptTemplateBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ====== 去AI味配置 ======
class DeAIStyleBase(BaseModel):
    name: str
    description: Optional[str] = None
    rules: Optional[dict] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None

class DeAIStyleCreate(DeAIStyleBase): pass

class DeAIStyleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[dict] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None
    status: Optional[str] = None

class DeAIStyleResponse(DeAIStyleBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ====== MCP服务配置 ======
class MCPServiceBase(BaseModel):
    name: str
    url: str
    description: Optional[str] = None
    service_type: str = "工具"
    config: Optional[dict] = None

class MCPServiceCreate(MCPServiceBase): pass

class MCPServiceUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    service_type: Optional[str] = None
    config: Optional[dict] = None

class MCPServiceResponse(MCPServiceBase):
    id: int
    status: str
    last_check_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ====== Skills技能配置 ======
class SkillBase(BaseModel):
    name: str
    description: Optional[str] = None
    version: str = "v1.0"
    category: str = "通用"
    content: Optional[dict] = None

class SkillCreate(SkillBase): pass

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    category: Optional[str] = None
    content: Optional[dict] = None
    status: Optional[str] = None

class SkillResponse(SkillBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ====== Hermes渠道配置 ======
class HermesChannelBase(BaseModel):
    name: str
    channel_type: str
    config: Optional[dict] = None
    description: Optional[str] = None

class HermesChannelCreate(HermesChannelBase): pass

class HermesChannelUpdate(BaseModel):
    name: Optional[str] = None
    channel_type: Optional[str] = None
    config: Optional[dict] = None
    description: Optional[str] = None

class HermesChannelResponse(HermesChannelBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ====== 专用操作 Request/Response ======

class PromptTestRequest(BaseModel):
    """提示词模板测试请求"""
    variables: dict = {}
    input_text: str = ""

class PromptTestResponse(BaseModel):
    """提示词模板测试响应"""
    prompt_id: int
    prompt_name: str
    rendered: str
    variables_used: list[str]
    simulated_response: str

class DeAITestRequest(BaseModel):
    """去AI味测试请求"""
    input_text: str

class SkillExecuteRequest(BaseModel):
    """技能执行请求"""
    params: dict = {}
    input_text: str = ""

class SkillExecuteResponse(BaseModel):
    """技能执行响应"""
    skill_id: int
    skill_name: str
    success: bool
    duration: str
    output: str
    deps_healthy: int
    deps_total: int

class HermesSendRequest(BaseModel):
    """Hermes消息发送请求"""
    message: str

class HermesSendResponse(BaseModel):
    """Hermes消息发送响应"""
    channel_id: int
    channel_name: str
    success: bool
    message_id: str
    latency: str
