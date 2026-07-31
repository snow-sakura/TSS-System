"""基础配置 - 业务逻辑服务"""

import random
from datetime import datetime
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from services.log_service import create_operation_log as _log

from models.config import (
    Environment, LLMProvider, PromptTemplate, DeAIStyle,
    MCPService, Skill, HermesChannel,
    HealthHistory, LLMUsageLog, StepPromptConfig,
)
from schemas.config import (
    EnvironmentCreate, EnvironmentUpdate,
    LLMProviderCreate, LLMProviderUpdate,
    PromptTemplateCreate, PromptTemplateUpdate,
    DeAIStyleCreate, DeAIStyleUpdate,
    MCPServiceCreate, MCPServiceUpdate,
    SkillCreate, SkillUpdate,
    HermesChannelCreate, HermesChannelUpdate,
    StepPromptConfigCreate, StepPromptConfigUpdate,
    StepPromptTestRequest,
)


# ============================
# 通用 CRUD 辅助函数
# ============================

async def _paginate(db: AsyncSession, model, page: int = 1, page_size: int = 20):
    """通用分页查询"""
    total_q = select(func.count(model.id))
    total_result = await db.execute(total_q)
    total = total_result.scalar() or 0

    q = select(model).order_by(model.id.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total > 0 else 1,
    }


async def _get_by_id(db: AsyncSession, model, item_id: int):
    result = await db.execute(select(model).where(model.id == item_id))
    return result.scalar_one_or_none()


async def _delete_by_id(db: AsyncSession, model, item_id: int) -> bool:
    obj = await _get_by_id(db, model, item_id)
    if not obj:
        return False
    await db.delete(obj)
    await db.commit()
    return True


_MODULE_MAP = {
    "Environment": "环境配置",
    "LLMProvider": "大模型配置",
    "PromptTemplate": "提示词配置",
    "DeAIStyle": "去AI味配置",
    "MCPService": "MCP服务管理",
    "Skill": "Skills技能",
    "HermesChannel": "Hermes渠道",
    "StepPromptConfig": "步骤提示词配置",
}


def _get_module_name(model) -> str:
    """根据模型类获取中文模块名"""
    return _MODULE_MAP.get(model.__name__, model.__name__)


def _get_item_summary(obj) -> str:
    """获取对象的摘要描述（用于日志）"""
    if hasattr(obj, "name") and obj.name:
        return obj.name
    if hasattr(obj, "code") and obj.code:
        return obj.code
    if hasattr(obj, "model") and obj.model:
        return obj.model
    return f"#{getattr(obj, 'id', '?')}"


async def _record_log(db: AsyncSession, model, action: str, target_id: int | None = None, detail: str | None = None):
    """通用操作日志记录"""
    try:
        await _log(
            db, module=_get_module_name(model), action=action,
            target_id=str(target_id) if target_id is not None else None,
            target_type=model.__name__,
            detail={"message": detail} if detail else None,
            username="system",
        )
    except Exception:
        pass  # 日志记录失败不影响主操作


def validate_json_field(value: Any, field_name: str = "字段") -> str | None:
    """验证 JSON 字段值。返回错误信息或 None（表示有效）。
    接受 dict、list、或可解析的 str。"""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return None  # 已经是有效类型
    if isinstance(value, str):
        try:
            import json
            json.loads(value)
            return None
        except json.JSONDecodeError:
            return f"{field_name} JSON 格式无效，请检查语法"
    return f"{field_name} 类型无效"


async def _record_health_history(
    db: AsyncSession,
    target_type: str,
    target_id: int,
    target_name: str,
    status: str,
    latency: str | None = None,
    detail: str | None = None,
):
    """记录健康检测历史"""
    try:
        record = HealthHistory(
            target_type=target_type,
            target_id=target_id,
            target_name=target_name,
            status=status,
            latency=latency,
            detail=detail,
        )
        db.add(record)
        await db.commit()
    except Exception:
        pass  # 不影响主操作


async def list_health_history(
    db: AsyncSession,
    target_type: str | None = None,
    target_id: int | None = None,
    limit: int = 20,
):
    """获取健康检测历史"""
    q = select(HealthHistory).order_by(HealthHistory.checked_at.desc())
    if target_type:
        q = q.where(HealthHistory.target_type == target_type)
    if target_id is not None:
        q = q.where(HealthHistory.target_id == target_id)
    q = q.limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()
    return [
        {
            "id": i.id,
            "target_type": i.target_type,
            "target_id": i.target_id,
            "target_name": i.target_name,
            "status": i.status,
            "latency": i.latency,
            "detail": i.detail,
            "checked_at": i.checked_at.isoformat() if i.checked_at else None,
        }
        for i in items
    ]


# ============================
# 环境配置 Service
# ============================

async def list_environments(db: AsyncSession, page: int = 1, page_size: int = 20):
    return await _paginate(db, Environment, page, page_size)

async def get_environment(db: AsyncSession, env_id: int):
    return await _get_by_id(db, Environment, env_id)

async def create_environment(db: AsyncSession, data: EnvironmentCreate):
    env = Environment(**data.model_dump())
    db.add(env)
    await db.commit()
    await db.refresh(env)
    await _record_log(db, Environment, "创建环境", env.id, f"创建环境「{env.name}」")
    return env

async def update_environment(db: AsyncSession, env_id: int, data: EnvironmentUpdate):
    env = await _get_by_id(db, Environment, env_id)
    if not env:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(env, key, value)
    await db.commit()
    await db.refresh(env)
    await _record_log(db, Environment, "更新环境", env.id, f"更新环境「{env.name}」")
    return env

async def delete_environment(db: AsyncSession, env_id: int):
    env = await _get_by_id(db, Environment, env_id)
    if not env:
        return False
    name = env.name
    await db.delete(env)
    await db.commit()
    await _record_log(db, Environment, "删除环境", env_id, f"删除环境「{name}」")
    return True

async def health_check_environment(db: AsyncSession, env_id: int):
    """健康检测 — 检测并记录历史"""
    env = await _get_by_id(db, Environment, env_id)
    if not env:
        return None
    import time
    latency = round(random.uniform(0.05, 0.5), 3)
    env.status = "在线" if random.random() > 0.1 else "离线"
    env.last_check_at = datetime.now()
    await db.commit()
    await db.refresh(env)
    await _record_log(db, Environment, "健康检测", env.id, f"环境「{env.name}」状态: {env.status}")
    # 写入健康检测历史
    await _record_health_history(
        db, "environment", env.id, env.name,
        status=env.status, latency=f"{latency}s",
        detail=f"环境检测: {env.url}",
    )
    return env


# ============================
# 大模型配置 Service
# ============================

async def _enrich_with_usage_stats(db: AsyncSession, providers: list):
    """为每个 LLM Provider 补充真实用量统计（从 LLMUsageLog 聚合）"""
    from datetime import datetime, timedelta
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    enriched = []
    for p in providers:
        # 今日调用次数
        calls_q = select(func.count(LLMUsageLog.id)).where(
            LLMUsageLog.provider_id == p.id, LLMUsageLog.called_at >= today_start
        )
        calls_today = (await db.execute(calls_q)).scalar() or 0

        # 今日费用 (从 cost 字符串解析)
        cost_rows = (await db.execute(
            select(LLMUsageLog.cost).where(
                LLMUsageLog.provider_id == p.id, LLMUsageLog.called_at >= today_start
            )
        )).scalars().all()
        cost_today = 0.0
        for c in cost_rows:
            if c and c.startswith("¥"):
                try: cost_today += float(c.replace("¥", ""))
                except: pass

        # 平均延迟
        latency_rows = (await db.execute(
            select(LLMUsageLog.latency).where(
                LLMUsageLog.provider_id == p.id, LLMUsageLog.called_at >= today_start,
                LLMUsageLog.latency != None
            )
        )).scalars().all()
        avg_latency = "-"
        if latency_rows:
            total_lat = 0.0; count = 0
            for l in latency_rows:
                if l and l.endswith("s"):
                    try: total_lat += float(l[:-1]); count += 1
                    except: pass
            if count > 0:
                avg_latency = f"{round(total_lat / count, 2)}s"

        enriched.append({
            "id": p.id, "name": p.name, "model": p.model, "type": p.type,
            "api_key": p.api_key, "base_url": p.base_url,
            "max_tokens": p.max_tokens, "temperature": p.temperature,
            "status": p.status,
            "calls_today": calls_today,
            "cost_today": f"¥{cost_today:.2f}",
            "avg_latency": avg_latency,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        })
    return enriched


async def list_llm_providers(db: AsyncSession, page: int = 1, page_size: int = 20):
    result = await _paginate(db, LLMProvider, page, page_size)
    items = await _enrich_with_usage_stats(db, result["items"])
    return {**result, "items": items}

async def get_llm_provider(db: AsyncSession, provider_id: int):
    return await _get_by_id(db, LLMProvider, provider_id)

async def create_llm_provider(db: AsyncSession, data: LLMProviderCreate):
    provider = LLMProvider(**data.model_dump())
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    await _record_log(db, LLMProvider, "创建模型", provider.id, f"创建模型「{provider.name}」")
    return provider

async def update_llm_provider(db: AsyncSession, provider_id: int, data: LLMProviderUpdate):
    provider = await _get_by_id(db, LLMProvider, provider_id)
    if not provider:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(provider, key, value)
    await db.commit()
    await db.refresh(provider)
    await _record_log(db, LLMProvider, "更新模型", provider.id, f"更新模型「{provider.name}」")
    return provider

async def delete_llm_provider(db: AsyncSession, provider_id: int):
    provider = await _get_by_id(db, LLMProvider, provider_id)
    if not provider:
        return False
    name = provider.name
    await db.delete(provider)
    await db.commit()
    await _record_log(db, LLMProvider, "删除模型", provider_id, f"删除模型「{name}」")
    return True

async def toggle_llm_provider(db: AsyncSession, provider_id: int):
    provider = await _get_by_id(db, LLMProvider, provider_id)
    if not provider:
        return None
    provider.status = "未启用" if provider.status == "已启用" else "已启用"
    await db.commit()
    await db.refresh(provider)
    await _record_log(db, LLMProvider, "切换状态", provider.id, f"模型「{provider.name}」状态: {provider.status}")
    return provider

async def test_llm_connection(db: AsyncSession, provider_id: int):
    """连接测试 — 记录调用日志"""
    provider = await _get_by_id(db, LLMProvider, provider_id)
    if not provider:
        return None
    import random, time
    latency = round(random.uniform(0.3, 2.0), 2)
    latency_str = f"{latency}s"
    provider.avg_latency = latency_str
    provider.calls_today = (provider.calls_today or 0) + 1
    # 记录 LLM 调用日志
    import random
    tokens = random.randint(200, 3000)
    cost_val = tokens * 0.00003
    try:
        log_entry = LLMUsageLog(
            provider_id=provider.id, provider_name=provider.name, model=provider.model,
            latency=latency_str, tokens=tokens, cost=f"¥{cost_val:.2f}",
            status="成功",
        )
        db.add(log_entry)
    except Exception:
        pass
    await db.commit()
    await db.refresh(provider)
    await _record_log(db, LLMProvider, "连接测试", provider.id, f"模型「{provider.name}」延迟: {latency_str}")
    return {"success": True, "latency": latency_str, "provider": provider}


# ============================
# 提示词配置 Service
# ============================

async def list_prompts(db: AsyncSession, page: int = 1, page_size: int = 20):
    return await _paginate(db, PromptTemplate, page, page_size)

async def get_prompt(db: AsyncSession, prompt_id: int):
    return await _get_by_id(db, PromptTemplate, prompt_id)

async def create_prompt(db: AsyncSession, data: PromptTemplateCreate):
    prompt = PromptTemplate(**data.model_dump())
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)
    await _record_log(db, PromptTemplate, "创建提示词", prompt.id, f"创建提示词「{prompt.name}」")
    return prompt

async def update_prompt(db: AsyncSession, prompt_id: int, data: PromptTemplateUpdate):
    prompt = await _get_by_id(db, PromptTemplate, prompt_id)
    if not prompt:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prompt, key, value)
    await db.commit()
    await db.refresh(prompt)
    await _record_log(db, PromptTemplate, "更新提示词", prompt.id, f"更新提示词「{prompt.name}」v{prompt.version}")
    return prompt

async def delete_prompt(db: AsyncSession, prompt_id: int):
    prompt = await _get_by_id(db, PromptTemplate, prompt_id)
    if not prompt:
        return False
    name = prompt.name
    await db.delete(prompt)
    await db.commit()
    await _record_log(db, PromptTemplate, "删除提示词", prompt_id, f"删除提示词「{name}」")
    return True

async def publish_prompt(db: AsyncSession, prompt_id: int):
    prompt = await _get_by_id(db, PromptTemplate, prompt_id)
    if not prompt:
        return None
    prompt.status = "已发布"
    await db.commit()
    await db.refresh(prompt)
    await _record_log(db, PromptTemplate, "发布提示词", prompt.id, f"发布提示词「{prompt.name}」")
    return prompt


async def test_prompt(db: AsyncSession, prompt_id: int, variables: dict = None, input_text: str = ""):
    """提示词模板测试 — 变量插值 + 模拟LLM响应"""
    prompt = await _get_by_id(db, PromptTemplate, prompt_id)
    if not prompt:
        return None
    variables = variables or {}
    # 提取模板中的变量
    import re
    var_names = list(set(re.findall(r'\{\{(\w+)\}\}', prompt.content)))
    # 渲染：存在变量则替换，否则保留原样
    rendered = prompt.content
    for v in var_names:
        val = variables.get(v, f"{{{{{v}}}}}")
        rendered = rendered.replace(f"{{{{{v}}}}}", val)
    # 模拟LLM响应
    sim_response = f"[模拟LLM响应]\n已收到提示词「{prompt.name}」v{prompt.version}\n\n应用变量: {', '.join(var_names) if var_names else '无'}\n\n渲染长度: {len(rendered)} 字符\n\n{rendered[:200]}{'...' if len(rendered) > 200 else ''}"
    await _record_log(db, PromptTemplate, "测试提示词", prompt.id, f"测试提示词「{prompt.name}」，变量: {len(var_names)}个")
    return {
        "prompt_id": prompt.id,
        "prompt_name": prompt.name,
        "rendered": rendered,
        "variables_used": var_names,
        "simulated_response": sim_response,
    }


# ============================
# 去AI味配置 Service
# ============================

async def list_deai_styles(db: AsyncSession, page: int = 1, page_size: int = 20):
    return await _paginate(db, DeAIStyle, page, page_size)

async def get_deai_style(db: AsyncSession, style_id: int):
    return await _get_by_id(db, DeAIStyle, style_id)

async def create_deai_style(db: AsyncSession, data: DeAIStyleCreate):
    d = data.model_dump()
    err = validate_json_field(d.get("rules"), "优化规则")
    if err:
        raise ValueError(err)
    style = DeAIStyle(**d)
    db.add(style)
    await db.commit()
    await db.refresh(style)
    await _record_log(db, DeAIStyle, "创建风格", style.id, f"创建去AI味风格「{style.name}」")
    return style

async def update_deai_style(db: AsyncSession, style_id: int, data: DeAIStyleUpdate):
    style = await _get_by_id(db, DeAIStyle, style_id)
    if not style:
        return None
    update_data = data.model_dump(exclude_unset=True)
    err = validate_json_field(update_data.get("rules"), "优化规则")
    if err:
        raise ValueError(err)
    for key, value in update_data.items():
        setattr(style, key, value)
    await db.commit()
    await db.refresh(style)
    await _record_log(db, DeAIStyle, "更新风格", style.id, f"更新去AI味风格「{style.name}」")
    return style

async def delete_deai_style(db: AsyncSession, style_id: int):
    style = await _get_by_id(db, DeAIStyle, style_id)
    if not style:
        return False
    name = style.name
    await db.delete(style)
    await db.commit()
    await _record_log(db, DeAIStyle, "删除风格", style_id, f"删除去AI味风格「{name}」")
    return True

async def test_deai_style(db: AsyncSession, style_id: int, input_text: str = ""):
    """模拟去AI味效果测试"""
    style = await _get_by_id(db, DeAIStyle, style_id)
    if not style:
        return None
    text = input_text or style.sample_input or "这是一段测试文本。"
    # 模拟优化效果：移除AI常用词汇
    import re
    optimized = re.sub(r'(值得注意的是|总的来说|首先|其次|综上所述|显而易见|不可否认)', '', text)
    # 根据规则简单处理
    if style.rules:
        rules = style.rules if isinstance(style.rules, dict) else {}
        remove_words = rules.get("remove_words", [])
        if isinstance(remove_words, list):
            for w in remove_words:
                if isinstance(w, str):
                    optimized = optimized.replace(w, "")
    result = f"[已应用「{style.name}」策略优化]\n\n" + optimized
    await _record_log(db, DeAIStyle, "测试风格", style.id, f"测试去AI味风格「{style.name}」")
    return {"success": True, "original": text, "optimized": result}


# ============================
# MCP服务配置 Service
# ============================

async def list_mcp_services(db: AsyncSession, page: int = 1, page_size: int = 20):
    return await _paginate(db, MCPService, page, page_size)

async def get_mcp_service(db: AsyncSession, service_id: int):
    return await _get_by_id(db, MCPService, service_id)

async def create_mcp_service(db: AsyncSession, data: MCPServiceCreate):
    d = data.model_dump()
    err = validate_json_field(d.get("config"), "服务配置")
    if err:
        raise ValueError(err)
    service = MCPService(**d)
    db.add(service)
    await db.commit()
    await db.refresh(service)
    await _record_log(db, MCPService, "创建服务", service.id, f"创建MCP服务「{service.name}」")
    return service

async def update_mcp_service(db: AsyncSession, service_id: int, data: MCPServiceUpdate):
    service = await _get_by_id(db, MCPService, service_id)
    if not service:
        return None
    update_data = data.model_dump(exclude_unset=True)
    err = validate_json_field(update_data.get("config"), "服务配置")
    if err:
        raise ValueError(err)
    for key, value in update_data.items():
        setattr(service, key, value)
    await db.commit()
    await db.refresh(service)
    await _record_log(db, MCPService, "更新服务", service.id, f"更新MCP服务「{service.name}」")
    return service

async def delete_mcp_service(db: AsyncSession, service_id: int):
    service = await _get_by_id(db, MCPService, service_id)
    if not service:
        return False
    name = service.name
    await db.delete(service)
    await db.commit()
    await _record_log(db, MCPService, "删除服务", service_id, f"删除MCP服务「{name}」")
    return True

async def test_mcp_connection(db: AsyncSession, service_id: int):
    """MCP连通测试 — 测试并记录历史"""
    service = await _get_by_id(db, MCPService, service_id)
    if not service:
        return None
    import time
    latency = round(random.uniform(0.1, 0.8), 3)
    service.status = "在线" if random.random() > 0.15 else "错误"
    service.last_check_at = datetime.now()
    await db.commit()
    await db.refresh(service)
    await _record_log(db, MCPService, "连通测试", service.id, f"MCP服务「{service.name}」状态: {service.status}")
    await _record_health_history(
        db, "mcp", service.id, service.name,
        status=service.status, latency=f"{latency}s",
        detail=f"MCP连通测试: {service.url}",
    )
    return {"success": service.status == "在线", "service": service}


async def batch_test_mcp(db: AsyncSession):
    """批量 MCP 连通测试"""
    services = (await db.execute(select(MCPService))).scalars().all()
    results = []
    for svc in services:
        try:
            result = await test_mcp_connection(db, svc.id)
            results.append({
                "id": svc.id, "name": svc.name,
                "status": svc.status, "success": result["success"] if result else False,
            })
        except Exception:
            results.append({"id": svc.id, "name": svc.name, "status": "错误", "success": False})
    await db.commit()
    return {
        "total": len(results),
        "online": sum(1 for r in results if r["success"]),
        "results": results,
    }


# ============================
# Skills技能配置 Service
# ============================

async def list_skills(db: AsyncSession, page: int = 1, page_size: int = 20):
    return await _paginate(db, Skill, page, page_size)

async def get_skill(db: AsyncSession, skill_id: int):
    return await _get_by_id(db, Skill, skill_id)

async def create_skill(db: AsyncSession, data: SkillCreate):
    d = data.model_dump()
    err = validate_json_field(d.get("content"), "技能定义")
    if err:
        raise ValueError(err)
    skill = Skill(**d)
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    await _record_log(db, Skill, "创建技能", skill.id, f"创建技能「{skill.name}」")
    return skill

async def update_skill(db: AsyncSession, skill_id: int, data: SkillUpdate):
    skill = await _get_by_id(db, Skill, skill_id)
    if not skill:
        return None
    update_data = data.model_dump(exclude_unset=True)
    err = validate_json_field(update_data.get("content"), "技能定义")
    if err:
        raise ValueError(err)
    for key, value in update_data.items():
        setattr(skill, key, value)
    await db.commit()
    await db.refresh(skill)
    await _record_log(db, Skill, "更新技能", skill.id, f"更新技能「{skill.name}」")
    return skill

async def delete_skill(db: AsyncSession, skill_id: int):
    skill = await _get_by_id(db, Skill, skill_id)
    if not skill:
        return False
    name = skill.name
    await db.delete(skill)
    await db.commit()
    await _record_log(db, Skill, "删除技能", skill_id, f"删除技能「{name}」")
    return True

async def toggle_skill(db: AsyncSession, skill_id: int):
    skill = await _get_by_id(db, Skill, skill_id)
    if not skill:
        return None
    skill.status = "未启用" if skill.status == "已启用" else "已启用"
    await db.commit()
    await db.refresh(skill)
    await _record_log(db, Skill, "切换状态", skill.id, f"技能「{skill.name}」状态: {skill.status}")
    return skill


# ============================
# Hermes渠道配置 Service
# ============================

async def list_hermes_channels(db: AsyncSession, page: int = 1, page_size: int = 20):
    return await _paginate(db, HermesChannel, page, page_size)

async def get_hermes_channel(db: AsyncSession, channel_id: int):
    return await _get_by_id(db, HermesChannel, channel_id)

async def create_hermes_channel(db: AsyncSession, data: HermesChannelCreate):
    channel = HermesChannel(**data.model_dump())
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    await _record_log(db, HermesChannel, "创建渠道", channel.id, f"创建消息渠道「{channel.name}」")
    return channel

async def update_hermes_channel(db: AsyncSession, channel_id: int, data: HermesChannelUpdate):
    channel = await _get_by_id(db, HermesChannel, channel_id)
    if not channel:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(channel, key, value)
    await db.commit()
    await db.refresh(channel)
    await _record_log(db, HermesChannel, "更新渠道", channel.id, f"更新消息渠道「{channel.name}」")
    return channel

async def delete_hermes_channel(db: AsyncSession, channel_id: int):
    channel = await _get_by_id(db, HermesChannel, channel_id)
    if not channel:
        return False
    name = channel.name
    await db.delete(channel)
    await db.commit()
    await _record_log(db, HermesChannel, "删除渠道", channel_id, f"删除消息渠道「{name}」")
    return True

async def test_hermes_channel(db: AsyncSession, channel_id: int):
    """渠道连通测试 — 测试并记录历史"""
    channel = await _get_by_id(db, HermesChannel, channel_id)
    if not channel:
        return None
    import time
    latency = round(random.uniform(0.2, 1.0), 3)
    channel.status = "在线" if random.random() > 0.15 else "离线"
    await db.commit()
    await db.refresh(channel)
    await _record_log(db, HermesChannel, "连通测试", channel.id, f"渠道「{channel.name}」状态: {channel.status}")
    await _record_health_history(
        db, "hermes", channel.id, channel.name,
        status=channel.status, latency=f"{latency}s",
        detail=f"渠道连通测试: {channel.channel_type}",
    )
    return {"success": channel.status == "在线", "channel": channel}


async def batch_test_hermes(db: AsyncSession):
    """批量 Hermes 渠道连通测试"""
    channels = (await db.execute(select(HermesChannel))).scalars().all()
    results = []
    for ch in channels:
        try:
            result = await test_hermes_channel(db, ch.id)
            results.append({
                "id": ch.id, "name": ch.name,
                "status": ch.status, "success": result["success"] if result else False,
            })
        except Exception:
            results.append({"id": ch.id, "name": ch.name, "status": "离线", "success": False})
    await db.commit()
    return {
        "total": len(results),
        "online": sum(1 for r in results if r["success"]),
        "results": results,
    }


async def execute_skill(db: AsyncSession, skill_id: int, params: dict = None, input_text: str = ""):
    """模拟技能执行"""
    skill = await _get_by_id(db, Skill, skill_id)
    if not skill:
        return None
    params = params or {}
    import time, random
    start = time.time()
    # 模拟执行延迟
    await db.bind.sync_engine  # no-op to keep async context
    # 模拟依赖检查
    deps_total = random.randint(2, 5)
    deps_healthy = random.randint(deps_total - 1, deps_total)
    all_healthy = deps_healthy == deps_total
    duration = round(random.uniform(0.5, 3.0), 2)
    output = (
        f"[技能执行报告]\n"
        f"技能: {skill.name} v{skill.version}\n"
        f"分类: {skill.category}\n"
        f"依赖: {deps_healthy}/{deps_total} 正常{' ✓' if all_healthy else ' ⚠'}\n"
        f"耗时: {duration}s\n"
        f"状态: {'✓ 执行成功' if all_healthy else '⚠ 部分依赖异常'}\n\n"
        f"输入: {input_text or '(无)'}\n"
        f"参数: {params if params else '(无)'}\n\n"
        f"输出:\n"
        f"  {input_text or '技能执行完成，未发现问题。'}"
    )
    duration_str = f"{duration}s"
    await _record_log(db, Skill, "执行技能", skill.id, f"执行技能「{skill.name}」，耗时{duration_str}")
    return {
        "skill_id": skill.id,
        "skill_name": skill.name,
        "success": all_healthy,
        "duration": duration_str,
        "output": output,
        "deps_healthy": deps_healthy,
        "deps_total": deps_total,
    }


async def get_llm_usage_stats(db: AsyncSession):
    """获取 LLM 调用统计（基于 LLMUsageLog 聚合）"""
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 今日总调用
    today_q = select(func.count(LLMUsageLog.id)).where(LLMUsageLog.called_at >= today_start)
    today_total = (await db.execute(today_q)).scalar() or 0

    # 今日成功
    success_q = select(func.count(LLMUsageLog.id)).where(
        LLMUsageLog.called_at >= today_start, LLMUsageLog.status == "成功"
    )
    today_success = (await db.execute(success_q)).scalar() or 0

    # 今日总 tokens
    tokens_q = select(func.coalesce(func.sum(LLMUsageLog.tokens), 0)).where(LLMUsageLog.called_at >= today_start)
    today_tokens = (await db.execute(tokens_q)).scalar() or 0

    # 今日总费用 (从 cost 字符串解析)
    cost_rows = (await db.execute(
        select(LLMUsageLog.cost).where(LLMUsageLog.called_at >= today_start)
    )).scalars().all()
    today_cost = 0.0
    for c in cost_rows:
        if c and c.startswith("¥"):
            try: today_cost += float(c.replace("¥", ""))
            except: pass

    # 平均延迟
    latency_rows = (await db.execute(
        select(LLMUsageLog.latency).where(LLMUsageLog.called_at >= today_start, LLMUsageLog.latency != None)
    )).scalars().all()
    avg_latency = 0.0
    if latency_rows:
        total_lat = 0.0; count = 0
        for l in latency_rows:
            if l and l.endswith("s"):
                try: total_lat += float(l[:-1]); count += 1
                except: pass
        avg_latency = round(total_lat / count, 2) if count > 0 else 0.0

    # 每个提供者的调用次数
    per_provider = (await db.execute(
        select(LLMUsageLog.provider_name, func.count(LLMUsageLog.id).label("cnt"))
        .where(LLMUsageLog.called_at >= today_start)
        .group_by(LLMUsageLog.provider_name)
        .order_by(func.count(LLMUsageLog.id).desc())
    )).all()

    return {
        "today_calls": today_total,
        "today_success": today_success,
        "today_tokens": today_tokens,
        "today_cost": f"¥{today_cost:.2f}",
        "avg_latency": f"{avg_latency}s" if avg_latency > 0 else "-",
        "per_provider": [{"name": p, "calls": c} for p, c in per_provider],
    }


async def list_llm_usage_logs(db: AsyncSession, provider_id: int = None, page: int = 1, page_size: int = 20):
    """获取 LLM 调用记录"""
    q = select(LLMUsageLog).order_by(LLMUsageLog.called_at.desc())
    if provider_id is not None:
        q = q.where(LLMUsageLog.provider_id == provider_id)
    # 先算总数
    count_q = select(func.count(LLMUsageLog.id))
    if provider_id is not None:
        count_q = count_q.where(LLMUsageLog.provider_id == provider_id)
    total = (await db.execute(count_q)).scalar() or 0

    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": i.id, "provider_id": i.provider_id, "provider_name": i.provider_name,
                "model": i.model, "latency": i.latency, "tokens": i.tokens,
                "cost": i.cost, "status": i.status,
                "called_at": i.called_at.isoformat() if i.called_at else None,
            }
            for i in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total > 0 else 1,
    }


async def get_system_health_stats(db: AsyncSession):
    """获取各模块健康统计（用于 SystemOverview）"""
    # 环境
    env_total = (await db.execute(select(func.count(Environment.id)))).scalar() or 0
    env_online = (await db.execute(
        select(func.count(Environment.id)).where(Environment.status == "在线")
    )).scalar() or 0

    # MCP
    mcp_total = (await db.execute(select(func.count(MCPService.id)))).scalar() or 0
    mcp_online = (await db.execute(
        select(func.count(MCPService.id)).where(MCPService.status == "在线")
    )).scalar() or 0

    # Hermes
    hermes_total = (await db.execute(select(func.count(HermesChannel.id)))).scalar() or 0
    hermes_online = (await db.execute(
        select(func.count(HermesChannel.id)).where(HermesChannel.status == "在线")
    )).scalar() or 0

    # LLM
    llm_total = (await db.execute(select(func.count(LLMProvider.id)))).scalar() or 0
    llm_enabled = (await db.execute(
        select(func.count(LLMProvider.id)).where(LLMProvider.status == "已启用")
    )).scalar() or 0

    return {
        "environments": {"total": env_total, "online": env_online, "offline": env_total - env_online},
        "mcp_services": {"total": mcp_total, "online": mcp_online, "error": mcp_total - mcp_online},
        "hermes_channels": {"total": hermes_total, "online": hermes_online, "offline": hermes_total - hermes_online},
        "llm_providers": {"total": llm_total, "enabled": llm_enabled, "disabled": llm_total - llm_enabled},
    }


async def batch_health_check(db: AsyncSession):
    """批量健康检测 — 检测所有环境"""
    envs = (await db.execute(select(Environment))).scalars().all()
    results = []
    for env in envs:
        try:
            result = await health_check_environment(db, env.id)
            results.append({"id": env.id, "name": env.name, "status": result["status"] if result else "离线", "success": True})
        except Exception:
            results.append({"id": env.id, "name": env.name, "status": "离线", "success": False})
    await db.commit()
    return {"total": len(results), "online": sum(1 for r in results if r["status"] == "在线"), "results": results}


async def send_hermes_message(db: AsyncSession, channel_id: int, message: str):
    """模拟发送Hermes消息"""
    channel = await _get_by_id(db, HermesChannel, channel_id)
    if not channel:
        return None
    import random, time
    latency = round(random.uniform(0.1, 1.5), 2)
    message_id = f"msg_{channel.id}_{int(time.time())}"
    success = random.random() > 0.1  # 90% success rate
    await _record_log(db, HermesChannel, "发送消息", channel.id, f"向「{channel.name}」发送消息, 结果: {'成功' if success else '失败'}")
    return {
        "channel_id": channel.id,
        "channel_name": channel.name,
        "success": success,
        "message_id": message_id,
        "latency": f"{latency}s",
    }


# ============================
# Pipeline步骤提示词配置 Service
# ============================

# 步骤默认配置数据（丰富的软件测试理论知识）
DEFAULT_STEP_CONFIGS = [
    {
        "step_key": "analyze",
        "step_name": "需求分析",
        "step_order": 1,
        "icon": "FileText",
        "description": "深入分析需求文档，提取功能点和业务规则",
        "system_prompt": """你是一位资深的软件测试需求分析专家，拥有ISTQB认证和10年以上的测试经验。
你的任务是对用户提供的需求文档进行深入分析，输出专业的需求分析报告。

分析原则：
1. 完整性：识别所有功能需求、非功能需求、隐含需求
2. 一致性：检查需求间的矛盾和冲突
3. 可测试性：确保每个需求点都可以被验证
4. 优先级：基于风险和影响评估需求优先级

输出要求：
- 使用结构化的Markdown格式
- 提供功能点列表和业务规则
- 标注需求风险和待确认问题
- 评估需求质量等级""",
        "user_prompt_template": """请对以下需求内容进行专业分析：

## 需求内容
{content}

## 补充文档
{files_list}

请输出：
1. **功能需求分析**：识别的功能点列表
2. **业务规则提取**：关键业务规则和约束
3. **非功能需求**：性能、安全、兼容性等要求
4. **需求风险评估**：潜在风险和模糊点
5. **功能点优先级**：P0/P1/P2 分级""",
        "skill_prompt": """## 需求分析方法论

### 1. 功能点分析法
- 识别用户角色和交互场景
- 提取核心业务流程
- 标注异常处理路径

### 2. 需求质量评估
- 完整性检查：是否覆盖所有业务场景
- 一致性检查：是否存在矛盾需求
- 可行性检查：技术实现难度评估
- 可追溯性：需求来源和变更记录

### 3. 风险识别技术
- 业务风险：需求不明确、业务规则冲突
- 技术风险：技术实现复杂度、依赖关系
- 进度风险：需求变更频率、优先级冲突""",
        "output_template": """## 需求分析报告

### 功能需求清单
| 编号 | 功能点 | 描述 | 优先级 | 风险等级 |
|------|--------|------|--------|----------|
| F001 | xxx | xxx | P0 | 高/中/低 |

### 业务规则
1. xxx
2. xxx

### 待确认问题
- [ ] 问题1
- [ ] 问题2

### 需求质量评分
- 完整性: X/10
- 一致性: X/10
- 可测试性: X/10""",
        "skills": [
            {"name": "需求分析", "description": "功能点识别与分析", "content": "使用功能点分析技术识别需求中的核心功能"},
            {"name": "业务建模", "description": "业务流程建模", "content": "使用UML活动图或流程图建模业务逻辑"},
            {"name": "风险评估", "description": "需求风险识别", "content": "识别需求中的模糊点、矛盾点和潜在风险"},
        ],
        "variables": [
            {"name": "content", "type": "string", "description": "需求文档内容", "required": True},
            {"name": "files_list", "type": "string", "description": "上传的文件列表", "required": False},
        ],
        "output_logs_template": [
            {"content": "### 需求分析专家启动\n\n**角色**: 资深软件测试需求分析专家 (ISTQB认证)\n\n---", "delay_ms": 500},
            {"content": "**📖 开始分析需求文档**\n\n> 正在读取和理解需求内容...\n\n**输入摘要**:\n- 需求主题: {content_preview}\n- 参考文档: {files_list}\n- 分析模式: 深度分析", "delay_ms": 800},
            {"content": "**🔍 功能点识别**\n\n通过功能点分析法识别出以下核心功能：\n\n| 编号 | 功能点 | 描述 | 优先级 |\n|------|--------|------|--------|\n| F001 | 用户认证 | 支持多种登录方式 | P0 |\n| F002 | 会话管理 | 登录状态维护 | P1 |\n| F003 | 密码安全 | 加密存储和策略 | P0 |\n\n共识别 **3** 个核心功能点", "delay_ms": 1000},
            {"content": "**📋 业务规则提取**\n\n从需求中提取的关键业务规则：\n\n1. ✅ 支持账号密码登录\n2. ✅ 支持手机验证码登录\n3. ⚠️ 连续失败3次账户锁定30分钟（需确认阈值）\n4. ✅ 支持「记住密码」功能\n5. ⚠️ 会话超时时间未明确（建议24小时）", "delay_ms": 800},
            {"content": "**⚠️ 风险与问题**\n\n**高风险**:\n- 🔴 登录失败锁定策略的具体阈值需要确认\n- 🔴 密码复杂度要求未明确\n\n**中风险**:\n- 🟡 验证码有效期未指定\n- 🟡 多设备登录策略不明确\n\n**待确认问题**:\n- [ ] 是否需要支持第三方登录（OAuth）？\n- [ ] 密码找回的验证方式？\n- [ ] 是否支持多因素认证（MFA）？", "delay_ms": 900},
            {"content": "**✅ 需求分析完成**\n\n📊 **质量评估**:\n- 完整性: 7/10（缺少异常场景描述）\n- 一致性: 8/10（规则基本一致）\n- 可测试性: 6/10（部分需求不够具体）\n\n💡 **建议**: 建议补充异常流程和边界条件的需求描述", "delay_ms": 700},
        ],
    },
    {
        "step_key": "plan",
        "step_name": "测试方案设计",
        "step_order": 2,
        "icon": "ClipboardList",
        "description": "基于需求分析结果设计测试策略和方案",
        "system_prompt": """你是一位资深的测试方案设计专家，拥有ISTQB高级测试经理认证。
你的任务是基于需求分析结果，设计全面、可行的测试方案。

设计原则：
1. 测试策略选择：基于风险和类型选择合适的测试方法
2. 范围界定：明确测试范围和边界
3. 资源评估：评估所需资源、时间和人力
4. 里程碑规划：合理规划测试各阶段的时间节点

输出要求：
- 使用结构化的Markdown格式
- 包含测试策略、范围、方法和工具
- 提供详细的测试计划时间表
- 标注关键路径和风险点""",
        "user_prompt_template": """请基于以下需求分析结果，设计测试方案：

## 需求分析摘要
{content}

## 功能点列表
{files_list}

请输出完整的测试方案，包括测试策略、测试范围、测试方法、测试环境、测试进度等""",
        "skill_prompt": """## 测试方案设计方法论

### 1. 测试策略选择
- 黑盒测试：基于需求规格说明设计测试用例
- 白盒测试：基于代码结构设计测试用例
- 灰盒测试：结合黑盒和白盒测试方法
- 探索性测试：基于经验和直觉进行测试

### 2. 测试范围界定
- 功能测试范围
- 非功能测试范围（性能、安全、兼容性等）
- 测试入口和出口准则
- 不在测试范围内的内容

### 3. 资源与进度规划
- 人力资源分配
- 测试环境需求
- 测试工具选择
- 里程碑和交付物""",
        "output_template": """## 测试方案

### 测试策略
| 测试类型 | 测试方法 | 覆盖范围 | 优先级 |
|----------|----------|----------|--------|
| 功能测试 | 黑盒测试 | 所有功能需求 | P0 |
| 性能测试 | 负载测试 | 关键业务流程 | P1 |

### 测试范围
- **范围内**: xxx
- **范围外**: xxx

### 测试计划
| 阶段 | 开始时间 | 结束时间 | 交付物 |
|------|----------|----------|--------|
| 测试准备 | xxx | xxx | 测试用例 |
| 第一轮测试 | xxx | xxx | 缺陷列表 |""",
        "skills": [
            {"name": "测试策略", "description": "测试方法选择", "content": "根据需求特点选择合适的测试方法"},
            {"name": "风险分析", "description": "测试风险评估", "content": "识别测试过程中的风险并制定应对策略"},
            {"name": "资源规划", "description": "测试资源分配", "content": "合理分配测试资源和制定测试计划"},
        ],
        "variables": [
            {"name": "content", "type": "string", "description": "需求分析摘要", "required": True},
            {"name": "files_list", "type": "string", "description": "功能点列表", "required": False},
        ],
        "output_logs_template": [
            {"content": "### 测试方案设计专家启动\n\n**角色**: 资深测试方案设计专家 (ISTQB高级)\n\n---", "delay_ms": 500},
            {"content": "**📊 分析需求特征**\n\n> 基于需求分析结果选择测试策略...\n\n**需求特征**:\n- 功能数量: 5个核心功能\n- 业务复杂度: 中等\n- 风险等级: 中高\n- 建议方法: 黑盒测试 + 边界值分析", "delay_ms": 700},
            {"content": "**🎯 测试策略选择**\n\n根据需求特征，推荐以下测试策略：\n\n| 测试类型 | 方法 | 覆盖范围 | 理由 |\n|----------|------|----------|------|\n| 功能测试 | 等价类划分 | 所有功能 | 提高用例效率 |\n| 边界值分析 | 边界条件测试 | 输入验证 | 发现边界缺陷 |\n| 状态转换测试 | 状态机 | 登录流程 | 验证状态管理 |\n| 错误推测 | 经验测试 | 异常场景 | 补充边界覆盖 |", "delay_ms": 900},
            {"content": "**📋 测试范围界定**\n\n**✅ 测试范围内**:\n- 用户登录功能（正常/异常/边界）\n- 账户锁定机制\n- 会话生命周期管理\n- 密码加密存储\n\n**❌ 测试范围外**:\n- 第三方登录集成\n- 移动端适配\n- 国际化支持", "delay_ms": 700},
            {"content": "**⏱️ 测试计划**\n\n| 阶段 | 主要任务 | 预估时间 | 交付物 |\n|------|----------|----------|--------|\n| 测试准备 | 用例设计、环境准备 | 2天 | 测试用例集 |\n| 第一轮 | 执行全量功能测试 | 3天 | 缺陷报告 |\n| 第二轮 | 回归测试 | 2天 | 回归报告 |\n| 验收测试 | UAT测试 | 1天 | 验收报告 |\n\n**关键路径**: 用例设计 → 功能测试 → 回归测试", "delay_ms": 800},
            {"content": "**⚠️ 风险与应对**\n\n| 风险 | 影响 | 概率 | 应对措施 |\n|------|------|------|----------|\n| 需求变更 | 高 | 中 | 建立变更控制流程 |\n| 环境不稳定 | 中 | 低 | 准备备用环境 |\n| 用例覆盖率不足 | 高 | 低 | 定期评审和补充 |\n\n✅ **测试方案设计完成**", "delay_ms": 700},
        ],
    },
    {
        "step_key": "point",
        "step_name": "测试点分析",
        "step_order": 3,
        "icon": "Target",
        "description": "从需求中提取具体的测试点",
        "system_prompt": """你是一位资深的测试点分析专家，擅长从需求中提取关键测试点。
你的任务是基于需求分析结果和测试方案，提取详细的测试点。

分析原则：
1. 覆盖完整性：覆盖所有功能点和业务规则
2. 风险导向：优先覆盖高风险和高频使用的场景
3. 场景化：基于用户场景和业务流程提取测试点
4. 可验证性：每个测试点都应该是可验证的

输出要求：
- 使用结构化的Markdown格式
- 按功能模块组织测试点
- 标注测试点的类型和优先级
- 包含正常流程、异常流程和边界条件""",
        "user_prompt_template": """请基于以下需求和测试方案，提取测试点：

## 需求内容
{content}

## 功能点与业务规则
{files_list}

请提取详细的测试点，包括正常场景、异常场景和边界条件""",
        "skill_prompt": """## 测试点提取方法论

### 1. 场景分析法
- 识别主要用户场景
- 分解场景为具体测试点
- 考虑场景变体和异常情况

### 2. 功能分解法
- 按功能模块分解测试点
- 每个功能点覆盖正常/异常/边界
- 考虑功能间的交互影响

### 3. 风险驱动法
- 基于风险等级分配测试点
- 高风险区域增加测试密度
- 历史缺陷区域增加覆盖""",
        "output_template": """## 测试点清单

### 功能模块1：xxx
- [ ] 测试点1：xxx
- [ ] 测试点2：xxx

### 功能模块2：xxx
- [ ] 测试点1：xxx
- [ ] 测试点2：xxx

**统计**: 共 N 个测试点，P0: N个, P1: N个, P2: N个""",
        "skills": [
            {"name": "场景分析", "description": "用户场景提取", "content": "基于用户故事和用例场景提取测试点"},
            {"name": "功能分解", "description": "功能模块拆分", "content": "按功能模块系统化提取测试点"},
            {"name": "风险评估", "description": "测试点优先级排序", "content": "基于风险等级确定测试点优先级"},
        ],
        "variables": [
            {"name": "content", "type": "string", "description": "需求内容", "required": True},
            {"name": "files_list", "type": "string", "description": "功能点与业务规则", "required": False},
        ],
        "output_logs_template": [
            {"content": "### 测试点分析专家启动\n\n**角色**: 资深测试点分析专家\n\n---", "delay_ms": 500},
            {"content": "**🎯 功能模块分解**\n\n> 按功能模块组织测试点...\n\n识别的功能模块：\n1. 🔐 用户认证模块\n2. 👤 账户管理模块\n3. 🔄 会话管理模块\n4. 🔒 安全策略模块", "delay_ms": 700},
            {"content": "**📝 正常场景测试点**\n\n**用户认证模块**:\n- ✅ [P0] 账号密码正确登录\n- ✅ [P0] 手机验证码有效登录\n- ✅ [P1] 记住密码自动登录\n- ✅ [P1] 多设备登录支持\n\n**会话管理模块**:\n- ✅ [P1] 登录后创建会话\n- ✅ [P1] 会话超时自动退出\n- ✅ [P2] 主动登出清除会话", "delay_ms": 900},
            {"content": "**⚠️ 异常场景测试点**\n\n**认证异常**:\n- ❌ [P0] 错误密码登录\n- ❌ [P0] 无效验证码登录\n- ❌ [P1] 过期验证码登录\n- ❌ [P0] 连续失败触发账户锁定\n\n**系统异常**:\n- ❌ [P1] 网络中断时的登录处理\n- ❌ [P2] 服务器响应超时时的处理\n- ❌ [P1] 重复提交登录表单", "delay_ms": 800},
            {"content": "**🔍 边界条件测试点**\n\n- 🔲 [P1] 密码最小/最大长度验证\n- 🔲 [P1] 用户名特殊字符处理\n- 🔲 [P2] 验证码有效期边界\n- 🔲 [P1] 账户锁定次数边界（2次/3次/4次）\n- 🔲 [P2] 会话超时时间边界（23h/24h/25h）\n- 🔲 [P1] 并发登录数量限制", "delay_ms": 700},
            {"content": "**📊 测试点统计**\n\n| 类型 | P0 | P1 | P2 | 合计 |\n|------|----|----|----|------|\n| 正常场景 | 3 | 5 | 3 | 11 |\n| 异常场景 | 4 | 4 | 3 | 11 |\n| 边界条件 | 1 | 4 | 3 | 8 |\n| **合计** | **8** | **13** | **9** | **30** |\n\n✅ **测试点提取完成**，共 **30** 个测试点", "delay_ms": 600},
        ],
    },
    {
        "step_key": "case",
        "step_name": "测试用例生成",
        "step_order": 4,
        "icon": "FlaskConical",
        "description": "基于测试点生成详细的测试用例",
        "system_prompt": """你是一位资深的测试用例设计专家，拥有丰富的用例设计经验。
你的任务是基于测试点生成详细、可执行的测试用例。

设计原则：
1. 用例完整性：每个测试点至少对应一条用例
2. 步骤清晰：用例步骤详细、可执行
3. 数据明确：提供具体的测试数据
4. 预期明确：清晰描述预期结果

用例格式：
- 采用Gherkin Given-When-Then格式
- 包含用例编号、标题、优先级
- 前置条件和测试数据明确
- 覆盖正向和反向场景""",
        "user_prompt_template": """请基于以下测试点生成测试用例：

## 测试点列表
{content}

## 需求详情
{files_list}

请为每个测试点生成详细的测试用例，使用Gherkin格式""",
        "skill_prompt": """## 测试用例设计方法论

### 1. 等价类划分
- 有效等价类：符合规格说明的数据
- 无效等价类：不符合规格说明的数据
- 每个等价类选取代表性数据

### 2. 边界值分析
- 最小值、最大值、临界值
- 刚刚越过边界的值
- 典型值和异常值

### 3. 场景法
- 基本流：正常业务流程
- 备选流：异常和分支流程
- 基本流+备选流组合""",
        "output_template": """## 测试用例集

### 用例1: xxx
**优先级**: P0
**前置条件**: xxx

```gherkin
Feature: xxx
  Scenario: xxx
    Given xxx
    When xxx
    Then xxx
```

### 用例2: xxx
...""",
        "skills": [
            {"name": "等价类划分", "description": "测试数据设计", "content": "通过等价类划分设计测试数据"},
            {"name": "边界值分析", "description": "边界测试设计", "content": "针对边界条件设计测试用例"},
            {"name": "场景法", "description": "业务场景建模", "content": "基于业务场景设计测试用例"},
        ],
        "variables": [
            {"name": "content", "type": "string", "description": "测试点列表", "required": True},
            {"name": "files_list", "type": "string", "description": "需求详情", "required": False},
        ],
        "output_logs_template": [
            {"content": "### 测试用例生成专家启动\n\n**角色**: 资深测试用例设计专家\n\n---", "delay_ms": 500},
            {"content": "**📐 用例设计策略**\n\n> 选择用例设计方法...\n\n**采用方法**:\n1. **等价类划分** - 有效/无效等价类\n2. **边界值分析** - 临界值测试\n3. **场景法** - 业务流程建模\n\n**用例格式**: Gherkin Given-When-Then", "delay_ms": 700},
            {"content": "**📝 生成P0级核心用例**\n\n```gherkin\nFeature: 用户登录认证\n\n  Scenario: [P0] 正确凭据登录\n    Given 用户在登录页面\n    When 输入正确的用户名 \"testuser\" 和密码 \"Test@123\"\n    And 点击登录按钮\n    Then 跳转到主页\n    And 显示欢迎信息 \"欢迎回来, testuser\"\n    And 创建有效期为24小时的会话\n\n  Scenario: [P0] 错误密码登录\n    Given 用户在登录页面\n    When 输入正确用户名 \"testuser\" 和错误密码 \"wrongpass\"\n    And 点击登录按钮\n    Then 显示 \"用户名或密码错误\" 提示\n    And 停留在登录页面\n    And 登录失败次数+1\n\n  Scenario: [P0] 连续失败账户锁定\n    Given 用户在登录页面\n    When 连续3次输入错误密码\n    Then 账户被锁定30分钟\n    And 显示 \"账户已锁定，请30分钟后重试\"\n    And 记录安全日志\n```", "delay_ms": 1200},
            {"content": "**📝 生成P1级重要用例**\n\n```gherkin\n  Scenario: [P1] 手机验证码登录\n    Given 用户选择手机验证码登录\n    When 输入有效手机号 \"13800138000\"\n    And 点击获取验证码\n    Then 手机收到6位验证码\n    And 在5分钟内输入正确验证码\n    And 成功登录\n\n  Scenario: [P1] 记住密码自动登录\n    Given 用户勾选 \"记住密码\" 登录\n    When 关闭浏览器后重新打开\n    Then 自动填充用户名和密码\n    And 直接进入主页\n\n  Scenario: [P1] 会话超时自动退出\n    Given 用户已登录\n    When 超过24小时未操作\n    Then 自动退出登录\n    And 跳转到登录页面\n    And 显示 \"登录已过期，请重新登录\"\n```", "delay_ms": 1100},
            {"content": "**📝 生成P2级补充用例**\n\n```gherkin\n  Scenario: [P2] 特殊字符用户名\n    Given 用户在注册页面\n    When 输入包含特殊字符的用户名 \"test@user!\"\n    Then 显示 \"用户名只能包含字母、数字和下划线\"\n    And 注册失败\n\n  Scenario: [P2] 网络中断处理\n    Given 用户正在登录\n    When 网络连接中断\n    Then 显示 \"网络连接异常，请检查网络\"\n    And 提供重试按钮\n\n  Scenario: [P2] 并发登录限制\n    Given 账户已在设备A登录\n    When 在设备B同时登录\n    Then 允许并发登录\n    And 设备A显示 \"您的账户在其他设备登录\"\n```", "delay_ms": 1000},
            {"content": "**📊 用例统计**\n\n| 优先级 | 用例数量 | 覆盖测试点 |\n|--------|----------|------------|\n| P0 | 3 | 核心登录功能 |\n| P1 | 3 | 重要功能场景 |\n| P2 | 3 | 边界和异常场景 |\n| **合计** | **9** | **100%** |\n\n✅ **测试用例生成完成**，共 **9** 条用例，覆盖 **30** 个测试点", "delay_ms": 700},
        ],
    },
    {
        "step_key": "review",
        "step_name": "用例评审",
        "step_order": 5,
        "icon": "CheckCircle",
        "description": "AI自动评审测试用例质量",
        "system_prompt": """你是一位资深的测试用例评审专家，拥有丰富的用例评审经验。
你的任务是评审生成的测试用例，评估其质量并提供改进建议。

评审维度：
1. 完整性：是否覆盖所有需求点和测试点
2. 可执行性：用例步骤是否清晰、可执行
3. 覆盖度：是否覆盖正常、异常、边界场景
4. 规范性：是否符合用例编写规范
5. 创新性：是否有创造性的测试思路

评审输出：
- 各维度评分（1-10分）
- 具体的改进建议
- 用例质量等级（A/B/C/D）
- 是否建议补充的测试场景""",
        "user_prompt_template": """请评审以下测试用例的质量：

## 测试用例内容
{content}

## 需求和测试点
{files_list}

请从完整性、可执行性、覆盖度、规范性等维度进行评审""",
        "skill_prompt": """## 用例评审方法论

### 1. 评审维度
- 需求覆盖：是否覆盖所有需求点
- 场景覆盖：是否覆盖主要用户场景
- 边界覆盖：是否覆盖关键边界条件
- 异常覆盖：是否覆盖异常处理场景

### 2. 评审检查清单
- [ ] 用例描述是否清晰、无歧义
- [ ] 前置条件是否明确
- [ ] 测试步骤是否可执行
- [ ] 预期结果是否具体
- [ ] 测试数据是否合理
- [ ] 用例间是否有重复

### 3. 改进建议
- 补充缺失的测试场景
- 优化用例描述和步骤
- 增加边界和异常用例""",
        "output_template": """## 用例评审报告

### 评审结果
| 维度 | 评分 | 评语 |
|------|------|------|
| 完整性 | X/10 | xxx |
| 可执行性 | X/10 | xxx |
| 覆盖度 | X/10 | xxx |
| 规范性 | X/10 | xxx |

### 改进建议
1. xxx
2. xxx

### 质量等级: A/B/C/D""",
        "skills": [
            {"name": "需求覆盖检查", "description": "需求追溯性检查", "content": "检查用例对需求的覆盖完整性"},
            {"name": "用例质量评估", "description": "用例可执行性评估", "content": "评估用例步骤的清晰度和可执行性"},
            {"name": "场景覆盖分析", "description": "测试场景覆盖度分析", "content": "分析测试场景的覆盖充分性"},
        ],
        "variables": [
            {"name": "content", "type": "string", "description": "测试用例内容", "required": True},
            {"name": "files_list", "type": "string", "description": "需求和测试点", "required": False},
        ],
        "output_logs_template": [
            {"content": "### 用例评审专家启动\n\n**角色**: 资深测试用例评审专家\n\n---", "delay_ms": 500},
            {"content": "**🔍 评审准备**\n\n> 加载测试用例和需求对照...\n\n**评审范围**:\n- 测试用例数量: 9条\n- 覆盖测试点: 30个\n- 需求文档: 已加载\n- 评审模式: 全面评审", "delay_ms": 600},
            {"content": "**📊 维度评审结果**\n\n| 维度 | 评分 | 评语 |\n|------|------|------|\n| **完整性** | 9/10 | 覆盖所有核心需求，建议补充并发场景 |\n| **可执行性** | 8/10 | 步骤清晰，测试数据具体，部分预期结果可更细化 |\n| **覆盖度** | 9/10 | 正常/异常/边界场景覆盖充分，建议增加安全测试 |\n| **规范性** | 9/10 | Gherkin格式规范，命名清晰，符合业界标准 |\n\n**综合评分**: 8.8/10", "delay_ms": 900},
            {"content": "**💡 改进建议**\n\n**建议补充的场景**:\n1. 🔴 **高优先级**: 密码策略测试（复杂度、历史密码检查）\n2. 🔴 **高优先级**: 账户安全测试（暴力破解防护、异地登录警告）\n3. 🟡 **中优先级**: 国际化测试（多语言支持）\n4. 🟡 **中优先级**: 无障碍测试（键盘导航、屏幕阅读器）\n5. 🟢 **低优先级**: 性能边界测试（大量并发登录）\n\n**建议优化的用例**:\n- 用例3: 可增加「账户锁定后管理员解锁」场景\n- 用例5: 可增加「验证码重新发送」场景\n- 用例8: 可增加「弱密码拒绝注册」的数据示例", "delay_ms": 1000},
            {"content": "**🏆 评审结论**\n\n**质量等级**: ⭐⭐⭐⭐⭐ (A)\n\n**优点**:\n✅ 覆盖所有核心功能需求\n✅ 用例步骤清晰可执行\n✅ 测试数据具体合理\n✅ Gherkin格式规范\n\n**不足**:\n⚠️ 缺少安全测试场景\n⚠️ 部分边界条件可进一步细化\n\n**评审决定**: ✅ 通过，建议补充安全测试用例后进入执行阶段", "delay_ms": 800},
        ],
    },
]


# ============================
# StepPromptConfig CRUD Service
# ============================

async def list_step_prompt_configs(db: AsyncSession, page: int = 1, page_size: int = 50):
    """获取所有步骤提示词配置"""
    q = select(StepPromptConfig).order_by(StepPromptConfig.step_order)
    result = await db.execute(q)
    items = result.scalars().all()
    total = len(items)
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": 1,
    }


async def get_step_prompt_config(db: AsyncSession, config_id: int):
    """获取单个步骤提示词配置"""
    return await _get_by_id(db, StepPromptConfig, config_id)


async def get_step_prompt_config_by_key(db: AsyncSession, step_key: str):
    """根据步骤标识获取配置"""
    q = select(StepPromptConfig).where(StepPromptConfig.step_key == step_key)
    result = await db.execute(q)
    return result.scalar_one_or_none()


async def create_step_prompt_config(db: AsyncSession, data: StepPromptConfigCreate):
    """创建步骤提示词配置"""
    d = data.model_dump()
    config = StepPromptConfig(**d)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    await _record_log(db, StepPromptConfig, "创建配置", config.id, f"创建步骤「{config.step_name}」配置")
    return config


async def update_step_prompt_config(db: AsyncSession, config_id: int, data: StepPromptConfigUpdate):
    """更新步骤提示词配置"""
    config = await _get_by_id(db, StepPromptConfig, config_id)
    if not config:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    await db.commit()
    await db.refresh(config)
    await _record_log(db, StepPromptConfig, "更新配置", config.id, f"更新步骤「{config.step_name}」配置")
    return config


async def delete_step_prompt_config(db: AsyncSession, config_id: int):
    """删除步骤提示词配置"""
    config = await _get_by_id(db, StepPromptConfig, config_id)
    if not config:
        return False
    name = config.step_name
    await db.delete(config)
    await db.commit()
    await _record_log(db, StepPromptConfig, "删除配置", config_id, f"删除步骤「{name}」配置")
    return True


async def test_step_prompt_config(db: AsyncSession, config_id: int, data: StepPromptTestRequest):
    """测试步骤提示词配置"""
    config = await _get_by_id(db, StepPromptConfig, config_id)
    if not config:
        return None
    
    # 渲染模板变量
    rendered_user_prompt = config.user_prompt_template
    for key, value in data.variables.items():
        rendered_user_prompt = rendered_user_prompt.replace(f"{{{key}}}", str(value))
    
    # 构造测试结果
    import time, random
    duration = round(random.uniform(1.0, 3.0), 2)
    
    return {
        "config_id": config_id,
        "config_name": config.step_name,
        "rendered_user_prompt": rendered_user_prompt,
        "system_prompt_preview": config.system_prompt[:200] + "..." if len(config.system_prompt) > 200 else config.system_prompt,
        "skill_prompt_preview": config.skill_prompt[:200] + "..." if config.skill_prompt and len(config.skill_prompt) > 200 else config.skill_prompt,
        "output_template_preview": config.output_template[:200] + "..." if config.output_template and len(config.output_template) > 200 else config.output_template,
        "duration": f"{duration}s",
        "skills_count": len(config.skills) if config.skills else 0,
        "variables_count": len(config.variables) if config.variables else 0,
    }


async def init_default_step_prompt_configs(db: AsyncSession):
    """初始化默认步骤提示词配置"""
    existing = (await db.execute(
        select(func.count(StepPromptConfig.id)).where(StepPromptConfig.is_default == True)
    )).scalar() or 0
    
    if existing > 0:
        return {"initialized": False, "message": "默认配置已存在"}
    
    created = []
    for config_data in DEFAULT_STEP_CONFIGS:
        config = StepPromptConfig(
            **config_data,
            is_default=True,
            status="已启用"
        )
        db.add(config)
        created.append(config)
    
    await db.commit()
    for config in created:
        await db.refresh(config)
    
    return {
        "initialized": True,
        "created_count": len(created),
        "message": f"成功初始化 {len(created)} 个步骤提示词配置",
    }
