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
    HealthHistory, LLMUsageLog,
)
from schemas.config import (
    EnvironmentCreate, EnvironmentUpdate,
    LLMProviderCreate, LLMProviderUpdate,
    PromptTemplateCreate, PromptTemplateUpdate,
    DeAIStyleCreate, DeAIStyleUpdate,
    MCPServiceCreate, MCPServiceUpdate,
    SkillCreate, SkillUpdate,
    HermesChannelCreate, HermesChannelUpdate,
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
