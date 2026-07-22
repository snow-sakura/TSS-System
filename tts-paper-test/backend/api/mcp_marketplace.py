"""
MCP 市场 — 发现、浏览和安装 MCP 服务

提供内置的 MCP 服务市场，用户可浏览公开 MCP 服务模板，
一键安装到自己的 MCP 服务列表。

与 api/config.py 的 MCPService CRUD 配合使用：
  市场 browse → 安装 → 配置 CRUD
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from database import get_db
from schemas.common import ResponseModel
from services.config_service import create_mcp_service

router = APIRouter(prefix="/api/v1/mcp-marketplace", tags=["MCP市场"])


# ── 内置 MCP 服务市场模板 ──

BUILTIN_MCP_SERVICES = [
    {
        "id": "playwright-mcp",
        "name": "Playwright MCP",
        "version": "1.0.0",
        "publisher": "Microsoft",
        "description": "浏览器自动化控制，支持多标签页、截图、网络拦截。基于 @playwright/mcp 官方包。",
        "long_description": (
            "Playwright MCP 服务为 AI Agent 提供浏览器自动化能力。\n\n"
            "**功能**:\n"
            "- 页面导航与交互 (点击、输入、选择)\n"
            "- 页面快照与截图\n"
            "- 网络请求拦截与修改\n"
            "- 多标签页管理\n"
            "- Cookie 和存储管理\n\n"
            "**适用场景**: Web UI 自动化测试、页面数据采集、视觉回归测试"
        ),
        "category": "浏览器自动化",
        "tags": ["playwright", "browser", "e2e-test", "automation"],
        "install_url": "npx @playwright/mcp --port 8931",
        "default_url": "http://localhost:8931/sse",
        "transport": "sse",
        "icon": "Browser",
        "install_guide": "npx @playwright/mcp --port 8931",
        "tools": [
            {"name": "browser_navigate", "description": "导航到指定URL"},
            {"name": "browser_click", "description": "点击页面元素"},
            {"name": "browser_type", "description": "输入文本"},
            {"name": "browser_snapshot", "description": "获取页面可访问性快照"},
            {"name": "browser_screenshot", "description": "页面截图"},
        ],
        "downloads": 1280,
        "rating": 4.8,
    },
    {
        "id": "file-system",
        "name": "File System MCP",
        "version": "0.3.0",
        "publisher": "ModelContext",
        "description": "安全可控的文件系统操作，支持读写、搜索和目录管理。",
        "long_description": (
            "File System MCP 提供安全的文件系统操作接口。\n\n"
            "**功能**:\n"
            "- 文件读写 (支持文本和二进制)\n"
            "- 目录浏览与搜索\n"
            "- 文件移动/复制/删除\n"
            "- 文件搜索 (glob/regex)\n\n"
            "**适用场景**: 测试报告生成、日志收集、配置管理"
        ),
        "category": "文件操作",
        "tags": ["file", "storage", "fs"],
        "install_url": "npx @modelcontextprotocol/server-filesystem",
        "default_url": "http://localhost:9000",
        "transport": "stdio",
        "icon": "FileText",
        "install_guide": "npx @modelcontextprotocol/server-filesystem /allowed/path",
        "tools": [
            {"name": "read_file", "description": "读取文件内容"},
            {"name": "write_file", "description": "写入文件"},
            {"name": "list_directory", "description": "列出目录内容"},
            {"name": "search_files", "description": "搜索文件"},
        ],
        "downloads": 2150,
        "rating": 4.6,
    },
    {
        "id": "database",
        "name": "Database MCP",
        "version": "0.2.0",
        "publisher": "ModelContext",
        "description": "数据库查询与操作，支持 PostgreSQL、MySQL、SQLite。",
        "long_description": (
            "Database MCP 服务提供数据库操作能力。\n\n"
            "**功能**:\n"
            "- SQL 查询执行\n"
            "- 表结构浏览\n"
            "- 数据验证与断言\n"
            "- 事务支持\n\n"
            "**适用场景**: 测试数据准备、数据库断言、数据迁移验证"
        ),
        "category": "数据存储",
        "tags": ["database", "sql", "postgresql", "mysql"],
        "install_url": "npx @modelcontextprotocol/server-database",
        "default_url": "postgresql://localhost:5432",
        "transport": "stdio",
        "icon": "Database",
        "install_guide": "npx @modelcontextprotocol/server-database 'postgresql://user:pass@localhost/db'",
        "tools": [
            {"name": "query", "description": "执行 SQL 查询"},
            {"name": "list_tables", "description": "列出所有表"},
            {"name": "describe_table", "description": "查看表结构"},
        ],
        "downloads": 1890,
        "rating": 4.5,
    },
    {
        "id": "git",
        "name": "Git MCP",
        "version": "0.1.0",
        "publisher": "ModelContext",
        "description": "Git 仓库操作，支持提交、分支、日志查询和代码搜索。",
        "long_description": (
            "Git MCP 服务提供 Git 操作接口。\n\n"
            "**功能**:\n"
            "- 查看提交历史\n"
            "- 创建和管理分支\n"
            "- 查看文件差异\n"
            "- 搜索代码内容\n\n"
            "**适用场景**: 代码审查辅助、版本对比测试、变更影响分析"
        ),
        "category": "开发工具",
        "tags": ["git", "version-control", "code-review"],
        "install_url": "npx @modelcontextprotocol/server-git",
        "default_url": "",
        "transport": "stdio",
        "icon": "GitBranch",
        "install_guide": "npx @modelcontextprotocol/server-git /path/to/repo",
        "tools": [
            {"name": "git_log", "description": "查看提交历史"},
            {"name": "git_diff", "description": "查看文件变更"},
            {"name": "git_status", "description": "查看仓库状态"},
        ],
        "downloads": 960,
        "rating": 4.3,
    },
    {
        "id": "github-mcp",
        "name": "GitHub MCP",
        "version": "1.0.0",
        "publisher": "GitHub",
        "description": "GitHub API 集成，管理 Issue、PR、Code Review 和仓库操作。",
        "long_description": (
            "GitHub MCP 服务提供 GitHub API 集成。\n\n"
            "**功能**:\n"
            "- Issue 和 PR 管理\n"
            "- 代码搜索和文件浏览\n"
            "- 仓库管理\n"
            "- CI/CD 状态查询\n\n"
            "**适用场景**: 测试缺陷跟踪、代码审查自动化、CI 状态监控"
        ),
        "category": "开发工具",
        "tags": ["github", "git", "devops", "ci-cd"],
        "install_url": "npx @github/github-mcp-server",
        "default_url": "",
        "transport": "stdio",
        "icon": "Github",
        "install_guide": (
            "1. 安装: npm install -g @github/github-mcp-server\n"
            "2. 配置 GITHUB_TOKEN 环境变量\n"
            "3. 运行: github-mcp-server"
        ),
        "tools": [
            {"name": "search_issues", "description": "搜索 Issue"},
            {"name": "create_issue", "description": "创建 Issue"},
            {"name": "list_pull_requests", "description": "列出 PR"},
            {"name": "search_code", "description": "搜索代码"},
        ],
        "downloads": 3200,
        "rating": 4.9,
    },
    {
        "id": "slack",
        "name": "Slack MCP",
        "version": "0.1.0",
        "publisher": "ModelContext",
        "description": "Slack 消息发送、频道管理和消息搜索。",
        "long_description": (
            "Slack MCP 服务提供 Slack 工作空间集成。\n\n"
            "**功能**:\n"
            "- 发送消息到频道\n"
            "- 创建和管理频道\n"
            "- 搜索历史消息\n"
            "- 获取用户信息\n\n"
            "**适用场景**: 测试结果通知、告警推送、团队协作"
        ),
        "category": "消息通知",
        "tags": ["slack", "notification", "messaging"],
        "install_url": "npx @modelcontextprotocol/server-slack",
        "default_url": "",
        "transport": "stdio",
        "icon": "MessageSquare",
        "install_guide": "需要配置 SLACK_BOT_TOKEN 和 SLACK_TEAM_ID",
        "tools": [
            {"name": "send_message", "description": "发送消息"},
            {"name": "list_channels", "description": "列出频道"},
            {"name": "search_messages", "description": "搜索消息"},
        ],
        "downloads": 750,
        "rating": 4.2,
    },
]


class InstallMCPRequest(BaseModel):
    """安装 MCP 服务请求"""
    marketplace_id: str
    name: Optional[str] = None
    url: Optional[str] = None
    config: Optional[dict] = None


@router.get("/services", summary="浏览MCP市场")
async def list_marketplace(
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict]:
    """浏览 MCP 服务市场，可按分类和关键词筛选"""
    services = BUILTIN_MCP_SERVICES

    if category:
        services = [s for s in services if s["category"] == category]
    if search:
        q = search.lower()
        services = [
            s for s in services
            if q in s["name"].lower()
            or q in s["description"].lower()
            or any(q in t for t in s["tags"])
        ]

    return services


@router.get("/categories", summary="获取市场分类")
async def list_categories() -> list[dict]:
    """列出 MCP 服务市场的所有分类"""
    from collections import Counter
    cats = Counter(s["category"] for s in BUILTIN_MCP_SERVICES)
    return [
        {"name": cat, "count": count}
        for cat, count in cats.most_common()
    ]


@router.get("/services/{service_id}", summary="获取服务详情")
async def get_marketplace_service(service_id: str) -> dict:
    """获取市场中某个服务的详细信息"""
    for svc in BUILTIN_MCP_SERVICES:
        if svc["id"] == service_id:
            return svc
    raise HTTPException(status_code=404, detail="服务不存在")


@router.post("/install", summary="安装MCP服务到本机")
async def install_mcp_service(
    req: InstallMCPRequest,
    db: AsyncSession = Depends(get_db),
):
    """从市场安装 MCP 服务（创建到本地 MCP 服务列表）"""
    # 查找市场模板
    template = None
    for svc in BUILTIN_MCP_SERVICES:
        if svc["id"] == req.marketplace_id:
            template = svc
            break

    if not template:
        raise HTTPException(status_code=404, detail="市场中未找到该服务")

    # 准备安装数据
    service_name = req.name or template["name"]
    service_url = req.url or template.get("default_url", "")
    service_config = req.config or {}

    # 调用 config_service 创建 MCP 服务
    from schemas.config import MCPServiceCreate
    create_data = MCPServiceCreate(
        name=service_name,
        url=service_url,
        description=template["description"],
        service_type=template["category"],
        config={
            **service_config,
            "marketplace_id": req.marketplace_id,
            "install_guide": template.get("install_guide", ""),
            "transport": template.get("transport", "stdio"),
        },
    )

    service = await create_mcp_service(db, create_data)

    return {
        "ok": True,
        "message": f"「{service_name}」安装成功",
        "service": {
            "id": service.id,
            "name": service.name,
            "url": service.url,
            "status": service.status,
        },
    }
