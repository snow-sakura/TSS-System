"""TSS AI测试平台 - FastAPI 入口"""

import asyncio
import json
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

from config import get_settings
from core.logging_config import setup_logging
from database import init_db, engine, Base
from api.auth import router as auth_router
from api.users import router as users_router
from api.web_automation import router as web_router
from api.test_lifecycle import router as test_lifecycle_router
from api.pipeline import router as pipeline_router
from api.requirement_data import router as requirement_data_router
from api.config import router as config_router
from api.knowledge import router as knowledge_router
from api.ai_chat import router as ai_chat_router
from api.engines import router as engines_router
from api.mcp_marketplace import router as mcp_marketplace_router
from api.workflows import router as workflows_router

settings = get_settings()
setup_logging()
logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
logger.info(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
logger.info(f"  Log level: {'DEBUG' if settings.DEBUG else 'INFO'}")
logger.info(f"  Model: {settings.DEFAULT_LLM_MODEL}")
logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    logger.info(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} 启动中...")

    # 初始化数据库
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ 数据库表已创建/更新")

    # 创建默认数据
    await _create_default_data()

    logger.info(f"✅ {settings.APP_NAME} 启动完成")
    logger.info(f"📖 API文档: http://localhost:8000/docs")

    yield

    # 关闭
    await engine.dispose()
    logger.info(f"🛑 {settings.APP_NAME} 已关闭")


async def _create_default_data():
    """创建默认数据"""
    from sqlalchemy import select, func
    from database import AsyncSessionLocal
    from models.user import Role, User
    from models.config import Environment, LLMProvider, PromptTemplate, DeAIStyle, MCPService, Skill, HermesChannel, HealthHistory, LLMUsageLog
    from core.security import hash_password

    async with AsyncSessionLocal() as db:
        # 检查是否已有角色
        result = await db.execute(select(Role))
        if not result.scalars().first():
            # 创建默认角色
            admin_role = Role(name="admin", description="系统管理员")
            user_role = Role(name="user", description="普通用户")
            tester_role = Role(name="tester", description="测试工程师")
            developer_role = Role(name="developer", description="开发工程师")
            viewer_role = Role(name="viewer", description="观察者")
            db.add_all([admin_role, user_role, tester_role, developer_role, viewer_role])
            await db.flush()

            # 创建默认管理员
            admin = User(
                username="admin",
                email="admin@tss.local",
                display_name="管理员",
                hashed_password=hash_password("admin123"),
                is_superuser=True,
            )
            admin.roles.append(admin_role)
            db.add(admin)

            # 创建默认测试用户
            test_user = User(
                username="testuser",
                email="test@tss.local",
                display_name="测试员",
                hashed_password=hash_password("test123"),
            )
            test_user.roles.append(user_role)
            db.add(test_user)

            await db.commit()
            logger.info("✅ 默认用户/角色数据创建完成 (admin/admin123, testuser/test123)")

        # ── 环境配置默认数据 ──
        env_count = (await db.execute(select(func.count(Environment.id)))).scalar() or 0
        if env_count == 0:
            envs = [
                Environment(name="开发环境", url="http://localhost:3000",
                    db_url="sqlite:///dev.db", redis_url="redis://localhost:6379/0",
                    description="本地开发环境", status="在线", api_version="v1.0"),
                Environment(name="测试环境", url="https://test.api.tss.local",
                    db_url="postgresql://test:test@pg-test:5432/tss", redis_url="redis://redis-test:6379/0",
                    description="集成测试环境", status="在线", api_version="v1.0"),
                Environment(name="预发布环境", url="https://staging.api.tss.local",
                    db_url="postgresql://staging:xxx@pg-staging:5432/tss", redis_url="redis://redis-staging:6379/0",
                    description="预发布验证环境", status="离线", api_version="v2.0-beta"),
                Environment(name="生产环境", url="https://api.tss.local",
                    db_url="postgresql://prod:xxx@pg-prod:5432/tss", redis_url="redis://redis-prod:6379/0",
                    description="线上生产环境", status="在线", api_version="v2.0"),
            ]
            db.add_all(envs)
            await db.flush()
            logger.info(f"✅ 默认环境配置创建完成 ({len(envs)}条)")

        # ── 大模型配置默认数据 ──
        llm_count = (await db.execute(select(func.count(LLMProvider.id)))).scalar() or 0
        if llm_count == 0:
            llms = [
                LLMProvider(name="OpenAI GPT-4o", model="gpt-4o",
                    api_key="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", base_url="https://api.openai.com/v1",
                    type="Chat模型", status="已启用", max_tokens=128000, temperature=0.7),
                LLMProvider(name="OpenAI GPT-4o-mini", model="gpt-4o-mini",
                    api_key="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", base_url="https://api.openai.com/v1",
                    type="Chat模型", status="已启用", max_tokens=128000, temperature=0.3),
                LLMProvider(name="Claude 3.5 Sonnet", model="claude-3-5-sonnet-20240620",
                    api_key="sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx", base_url="https://api.anthropic.com/v1",
                    type="Chat模型", status="未启用", max_tokens=128000, temperature=0.5),
                LLMProvider(name="DeepSeek V3", model="deepseek-chat",
                    api_key="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", base_url="https://api.deepseek.com/v1",
                    type="Chat模型", status="未启用", max_tokens=128000, temperature=0.7),
            ]
            db.add_all(llms)
            await db.flush()
            logger.info(f"✅ 默认大模型配置创建完成 ({len(llms)}条)")

        # ── 提示词配置默认数据 ──
        prompt_count = (await db.execute(select(func.count(PromptTemplate.id)))).scalar() or 0
        if prompt_count == 0:
            prompts = [
                PromptTemplate(name="测试用例生成", category="生成类",
                    content="""你是一个专业的测试工程师。根据以下需求生成测试用例：
需求描述：{requirement}
模块：{module}
优先级：{priority}

请生成包含以下内容的测试用例：
1. 正常场景测试
2. 异常场景测试
3. 边界值测试

请使用中文输出。""",
                    variables={"requirement": "需求描述", "module": "模块", "priority": "优先级"},
                    version="1.0", status="已发布",
                    description="根据需求描述自动生成测试用例"),
                PromptTemplate(name="缺陷分析", category="分析类",
                    content="""分析以下缺陷信息，评估严重程度并提供修复建议：
缺陷标题：{title}
缺陷描述：{description}
影响版本：{version}

请输出：
1. 严重程度评估
2. 根因分析
3. 修复建议""",
                    variables={"title": "缺陷标题", "description": "缺陷描述", "version": "影响版本"},
                    version="1.0", status="已发布",
                    description="分析缺陷信息并给出修复建议"),
                PromptTemplate(name="测试报告生成", category="报告类",
                    content="""根据以下测试执行数据生成测试报告：
执行ID：{execution_id}
通过率：{pass_rate}
用例总数：{total_cases}
执行时间：{execution_time}

请生成专业的测试报告摘要。""",
                    variables={"execution_id": "执行ID", "pass_rate": "通过率", "total_cases": "用例总数", "execution_time": "执行时间"},
                    version="0.9", status="草稿",
                    description="从执行数据生成测试报告"),
            ]
            db.add_all(prompts)
            await db.flush()
            logger.info(f"✅ 默认提示词配置创建完成 ({len(prompts)}条)")

        # ── 去AI味配置默认数据 ──
        deai_count = (await db.execute(select(func.count(DeAIStyle.id)))).scalar() or 0
        if deai_count == 0:
            styles = [
                DeAIStyle(name="学术论文风格",
                    description="适用于学术论文场景，降低AI痕迹，提升正式感",
                    rules={
                        "remove_phrases": ["值得注意的是", "总的来说", "众所周知"],
                        "replace_rules": {"然而": "但", "因此": "所以", "此外": "另外"},
                        "sentence_variance": 0.6, "vocabulary_complexity": 0.8,
                    },
                    sample_input="值得注意的是，该算法在多项指标上均表现优异，总的来说，它优于现有方法。",
                    sample_output="该算法在多项指标上表现更好，但仍有改进空间。",
                    status="启用"),
                DeAIStyle(name="技术博客风格",
                    description="适用于技术博客场景，增加可读性和亲和力",
                    rules={
                        "remove_phrases": ["综上所述", "显而易见", "毋庸置疑"],
                        "replace_rules": {"实施": "做", "利用": "用", "诸如": "比如"},
                        "sentence_variance": 0.7, "vocabulary_complexity": 0.5,
                    },
                    sample_input="综上所述，我们实施了一套完整的监控方案，利用多种技术手段...",
                    sample_output="我们用多种技术手段搭了一套完整的监控方案...",
                    status="启用"),
                DeAIStyle(name="口语化风格",
                    description="适用于即时通讯场景，使用口语化表达",
                    rules={
                        "remove_phrases": ["首先", "其次", "最后", "综上所述"],
                        "replace_rules": {"获取": "拿到", "执行": "跑一下", "验证": "看看"},
                        "sentence_variance": 0.9, "vocabulary_complexity": 0.3,
                    },
                    status="禁用"),
            ]
            db.add_all(styles)
            await db.flush()
            logger.info(f"✅ 默认去AI味配置创建完成 ({len(styles)}条)")

        # ── MCP服务配置默认数据 ──
        mcp_count = (await db.execute(select(func.count(MCPService.id)))).scalar() or 0
        if mcp_count == 0:
            mcps = [
                MCPService(name="GitHub MCP Server", url="http://localhost:9090/mcp/github",
                    service_type="工具", status="在线",
                    description="GitHub API集成，支持仓库、PR、Issue操作",
                    config={"token_env_var": "GITHUB_TOKEN", "default_repo": ""}),
                MCPService(name="Filesystem MCP Server", url="http://localhost:9090/mcp/filesystem",
                    service_type="存储", status="在线",
                    description="本地文件系统读写服务",
                    config={"allowed_paths": ["/data", "/tmp"], "max_file_size_mb": 10}),
                MCPService(name="Database MCP Server", url="http://localhost:9090/mcp/database",
                    service_type="代理", status="离线",
                    description="数据库查询与操作服务",
                    config={"db_type": "postgresql", "max_connections": 5, "query_timeout_sec": 30}),
            ]
            db.add_all(mcps)
            await db.flush()
            logger.info(f"✅ 默认MCP服务配置创建完成 ({len(mcps)}条)")

        # ── Skills技能配置默认数据 ──
        skill_count = (await db.execute(select(func.count(Skill.id)))).scalar() or 0
        if skill_count == 0:
            skills = [
                Skill(name="需求分析专家", category="分析类",
                    description="从需求文档中提取功能点和业务规则，生成测试需求",
                    version="v1.0", status="已启用",
                    content={"command": "analyze_requirement", "model": "gpt-4o",
                             "temperature": 0.3, "max_tokens": 4000}),
                Skill(name="测试用例生成器", category="生成类",
                    description="根据需求自动生成测试用例（含正常/异常/边界场景）",
                    version="v1.0", status="已启用",
                    content={"command": "generate_test_cases", "model": "gpt-4o",
                             "temperature": 0.5, "max_tokens": 8000, "include_edge_cases": True}),
                Skill(name="质量报告生成", category="报告类",
                    description="从执行数据生成包含统计、趋势和建议的质量报告",
                    version="v1.0", status="未启用",
                    content={"command": "generate_report", "model": "gpt-4o-mini",
                             "temperature": 0.3, "include_charts": True, "format": "markdown"}),
                Skill(name="缺陷分类器", category="分析类",
                    description="自动分析缺陷报告，分类并分配优先级",
                    version="v1.0", status="已启用",
                    content={"command": "classify_defect", "model": "gpt-4o-mini",
                             "temperature": 0.2, "categories": ["UI", "功能", "性能", "安全", "兼容性"]}),
            ]
            db.add_all(skills)
            await db.flush()
            logger.info(f"✅ 默认Skills技能配置创建完成 ({len(skills)}条)")

        # ── Hermes渠道配置默认数据 ──
        hermes_count = (await db.execute(select(func.count(HermesChannel.id)))).scalar() or 0
        if hermes_count == 0:
            channels = [
                HermesChannel(name="内部通知群", channel_type="telegram",
                    description="用于发送所有级别的系统通知",
                    status="在线",
                    config={"chat_id": "-1001234567890", "notification_level": "all"}),
                HermesChannel(name="告警频道", channel_type="slack",
                    description="仅发送 WARNING 及以上级别的告警",
                    status="在线",
                    config={"webhook_url": "https://hooks.slack.com/services/xxx",
                            "channel": "#alerts", "notification_level": "warning"}),
                HermesChannel(name="测试报告频道", channel_type="discord",
                    description="测试报告自动推送",
                    status="离线",
                    config={"webhook_id": "123456", "webhook_token": "xxxx",
                            "notification_level": "info"}),
                HermesChannel(name="企业微信运维群", channel_type="wechat",
                    description="仅发送 ERROR 级别告警",
                    status="离线",
                    config={"webhook_url": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx",
                            "notification_level": "error"}),
            ]
            db.add_all(channels)
            await db.flush()
            logger.info(f"✅ 默认Hermes渠道配置创建完成 ({len(channels)}条)")

        # ── 健康检测历史种子数据 ──
        hh_count = (await db.execute(select(func.count(HealthHistory.id)))).scalar() or 0
        if hh_count == 0:
            from datetime import datetime, timedelta
            import random
            envs = (await db.execute(select(Environment))).scalars().all()
            histories = []
            for env in envs:
                base_time = datetime.utcnow() - timedelta(hours=24)
                for i in range(8):
                    status = "在线" if random.random() > 0.15 else "离线"
                    histories.append(HealthHistory(
                        target_type="environment", target_id=env.id, target_name=env.name,
                        status=status, latency=f"{random.uniform(0.05, 0.5):.3f}s",
                        detail=f"定时健康检测 - {env.url}",
                        checked_at=base_time + timedelta(hours=i * 3),
                    ))
            db.add_all(histories)
            await db.flush()
            logger.info(f"✅ 健康检测历史种子数据创建完成 ({len(histories)}条)")

        # ── LLM调用记录种子数据 ──
        llm_usage_count = (await db.execute(select(func.count(LLMUsageLog.id)))).scalar() or 0
        if llm_usage_count == 0:
            from datetime import datetime, timedelta
            import random
            providers = (await db.execute(select(LLMProvider))).scalars().all()
            usages = []
            for prov in providers:
                base_time = datetime.utcnow() - timedelta(hours=12)
                for i in range(random.randint(3, 8)):
                    latency = random.uniform(0.3, 3.0)
                    tokens = random.randint(100, 5000)
                    cost_val = tokens * 0.00003
                    usages.append(LLMUsageLog(
                        provider_id=prov.id, provider_name=prov.name, model=prov.model,
                        latency=f"{latency:.2f}s", tokens=tokens,
                        cost=f"¥{cost_val:.2f}", status="成功",
                        called_at=base_time + timedelta(hours=i * 1.5),
                    ))
            db.add_all(usages)
            await db.flush()
            logger.info(f"✅ LLM调用记录种子数据创建完成 ({len(usages)}条)")

        await db.commit()
        logger.info("🎉 所有默认种子数据已就绪")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="基于多智能体AI Agent的软件测试全生命周期管理平台",
    lifespan=lifespan,
)

# ── 全局异常处理器 ──
from fastapi.responses import JSONResponse

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """将 ValueError 转为 422 响应（用于 JSON 验证等）"""
    return JSONResponse(
        status_code=422,
        content={"success": False, "message": str(exc)},
    )

# ── 请求日志中间件 ──
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """记录所有HTTP请求"""
    start = time.time()
    method = request.method
    path = request.url.path
    qs = request.url.query
    full_path = f"{path}?{qs}" if qs else path

    # 不记录静态文件请求
    if path.startswith("/uploads/"):
        return await call_next(request)

    body = None
    if method in ("POST", "PUT") and "multipart" not in (request.headers.get("content-type", "")):
        try:
            body_bytes = await request.body()
            if body_bytes:
                body = body_bytes.decode("utf-8", errors="replace")[:500]
        except Exception:
            pass

    logger.info(f"→ {method} {full_path}")

    try:
        response = await call_next(request)
    except Exception as e:
        duration = round((time.time() - start) * 1000)
        logger.error(f"✗ {method} {full_path} — {type(e).__name__}: {e} ({duration}ms)")
        raise

    duration = round((time.time() - start) * 1000)
    status = response.status_code
    log_fn = logger.info if status < 400 else logger.warning if status < 500 else logger.error
    log_fn(f"← {method} {full_path} → {status} ({duration}ms)")
    return response


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务 (上传文档访问)
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# 路由注册
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(web_router, prefix="/api/v1")
app.include_router(test_lifecycle_router, prefix="/api/v1")
app.include_router(pipeline_router)
app.include_router(requirement_data_router)
app.include_router(config_router)
app.include_router(knowledge_router)
app.include_router(ai_chat_router)
app.include_router(engines_router)
app.include_router(mcp_marketplace_router)
app.include_router(workflows_router)


# ============ SSE 实时日志推送 ============

router_sse = APIRouter(prefix="/api/v1/sse", tags=["SSE实时日志"])

# 存储活跃的SSE连接
sse_connections: list[asyncio.Queue] = []


async def sse_log_generator(queue: asyncio.Queue, stage: str = ""):
    """SSE 日志流生成器"""
    try:
        while True:
            # 等待新日志，超时30秒发送心跳
            try:
                data = await asyncio.wait_for(queue.get(), timeout=30)
                yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
            except asyncio.TimeoutError:
                yield f": heartbeat\n\n"  # SSE 心跳注释行
    except asyncio.CancelledError:
        pass
    finally:
        if queue in sse_connections:
            sse_connections.remove(queue)


@router_sse.get("/logs")
async def sse_logs(request: Request, stage: str = ""):
    """SSE 实时日志流"""
    queue: asyncio.Queue = asyncio.Queue()
    sse_connections.append(queue)

    return StreamingResponse(
        sse_log_generator(queue, stage),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def broadcast_log(level: str, message: str, stage: str = "system", detail: str | None = None):
    """广播日志到所有SSE连接 + 同时打印到IDE终端"""
    timestamp = __import__("datetime").datetime.now().isoformat()
    data = {"level": level, "message": message, "stage": stage, "detail": detail, "timestamp": timestamp}

    # 打印到终端（带可读格式）
    stage_tag = f"[{stage}]" if stage and stage != "system" else ""
    emoji_map = {"AGENT": "🤖", "SSE": "📡", "INFO": "ℹ️", "WARN": "⚠️", "ERROR": "❌", "DEBUG": "🔍"}
    emoji = emoji_map.get(level, "📋")
    log_line = f"{emoji} {stage_tag} {message}"
    if level == "ERROR":
        logger.error(log_line)
    elif level in ("WARN", "WARNING"):
        logger.warning(log_line)
    else:
        logger.info(log_line)
    if detail:
        logger.debug(f"  └─ detail: {detail[:500]}")

    # 广播到SSE连接
    disconnected = []
    for queue in sse_connections:
        try:
            await queue.put(data)
        except Exception:
            disconnected.append(queue)
    for q in disconnected:
        sse_connections.remove(q)


app.include_router(router_sse)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 启动方式: `python main.py` 或 `uvicorn main:app --reload`")
    logger.info("📋 所有日志（含SSE实时内容）将在此终端完整输出")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
        access_log=True,
    )
