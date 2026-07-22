"""基础配置 - 所有配置模块的数据库模型"""

from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, Integer, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Environment(Base):
    """环境配置表"""
    __tablename__ = "environments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="环境名称")
    url: Mapped[str] = mapped_column(String(500), nullable=False, comment="服务地址")
    db_url: Mapped[str] = mapped_column(String(500), nullable=True, comment="数据库地址")
    redis_url: Mapped[str] = mapped_column(String(500), nullable=True, comment="缓存地址")
    description: Mapped[str] = mapped_column(String(500), nullable=True, comment="环境描述")
    status: Mapped[str] = mapped_column(String(20), default="在线", comment="状态：在线/离线")
    api_version: Mapped[str] = mapped_column(String(50), nullable=True, comment="API版本")
    last_check_at: Mapped[datetime] = mapped_column(DateTime, nullable=True, comment="上次检测时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class LLMProvider(Base):
    """大模型提供商配置表"""
    __tablename__ = "llm_providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="提供商名称")
    model: Mapped[str] = mapped_column(String(200), nullable=False, comment="模型名称")
    api_key: Mapped[str] = mapped_column(String(500), nullable=False, comment="API Key")
    base_url: Mapped[str] = mapped_column(String(500), nullable=True, comment="Base URL")
    type: Mapped[str] = mapped_column(String(50), default="Chat模型", comment="模型类型：Chat/视觉/多模态/Embedding")
    status: Mapped[str] = mapped_column(String(20), default="未启用", comment="状态：已启用/未启用")
    max_tokens: Mapped[int] = mapped_column(Integer, default=128000, comment="最大Token")
    temperature: Mapped[float] = mapped_column(Float, default=0.7, comment="温度参数")
    calls_today: Mapped[int] = mapped_column(Integer, default=0, comment="今日调用次数")
    avg_latency: Mapped[str] = mapped_column(String(20), default="-", comment="平均延迟")
    cost_today: Mapped[str] = mapped_column(String(50), default="¥0.00", comment="今日费用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class PromptTemplate(Base):
    """提示词模板配置表"""
    __tablename__ = "prompt_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="模板名称")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="模板内容")
    category: Mapped[str] = mapped_column(String(50), default="通用", comment="分类：通用/测试/开发/其他")
    version: Mapped[str] = mapped_column(String(20), default="v1.0", comment="版本号")
    status: Mapped[str] = mapped_column(String(20), default="草稿", comment="状态：草稿/已发布")
    variables: Mapped[dict] = mapped_column(JSON, nullable=True, comment="变量定义")
    description: Mapped[str] = mapped_column(String(500), nullable=True, comment="模板描述")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class DeAIStyle(Base):
    """去AI味风格策略表"""
    __tablename__ = "deai_styles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="策略名称")
    description: Mapped[str] = mapped_column(String(500), nullable=True, comment="策略描述")
    rules: Mapped[dict] = mapped_column(JSON, nullable=True, comment="优化规则")
    sample_input: Mapped[str] = mapped_column(Text, nullable=True, comment="示例输入")
    sample_output: Mapped[str] = mapped_column(Text, nullable=True, comment="示例输出")
    status: Mapped[str] = mapped_column(String(20), default="启用", comment="状态：启用/禁用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class MCPService(Base):
    """MCP服务配置表"""
    __tablename__ = "mcp_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="服务名称")
    url: Mapped[str] = mapped_column(String(500), nullable=False, comment="服务地址")
    description: Mapped[str] = mapped_column(String(500), nullable=True, comment="服务描述")
    service_type: Mapped[str] = mapped_column(String(50), default="工具", comment="类型：工具/存储/代理/其他")
    status: Mapped[str] = mapped_column(String(20), default="在线", comment="状态：在线/离线/错误")
    config: Mapped[dict] = mapped_column(JSON, nullable=True, comment="服务配置")
    last_check_at: Mapped[datetime] = mapped_column(DateTime, nullable=True, comment="上次检测时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class Skill(Base):
    """Skills技能配置表"""
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="技能名称")
    description: Mapped[str] = mapped_column(String(500), nullable=True, comment="技能描述")
    version: Mapped[str] = mapped_column(String(20), default="v1.0", comment="版本号")
    status: Mapped[str] = mapped_column(String(20), default="未启用", comment="状态：已启用/未启用")
    category: Mapped[str] = mapped_column(String(50), default="通用", comment="分类：通用/测试/开发/分析")
    content: Mapped[dict] = mapped_column(JSON, nullable=True, comment="技能定义内容")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class HermesChannel(Base):
    """Hermes消息渠道配置表"""
    __tablename__ = "hermes_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="渠道名称")
    channel_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="渠道类型：telegram/discord/slack/wechat/dingtalk")
    config: Mapped[dict] = mapped_column(JSON, nullable=True, comment="渠道配置")
    status: Mapped[str] = mapped_column(String(20), default="在线", comment="状态：在线/离线")
    description: Mapped[str] = mapped_column(String(500), nullable=True, comment="渠道描述")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class HealthHistory(Base):
    """健康检测历史记录表"""
    __tablename__ = "health_histories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="检测对象类型：environment/mcp/hermes")
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="检测对象ID")
    target_name: Mapped[str] = mapped_column(String(200), nullable=True, comment="检测对象名称")
    status: Mapped[str] = mapped_column(String(20), nullable=False, comment="检测结果：在线/离线/错误/成功/失败")
    latency: Mapped[str] = mapped_column(String(20), nullable=True, comment="延迟")
    detail: Mapped[str] = mapped_column(String(500), nullable=True, comment="详细信息")
    checked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False, comment="检测时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class LLMUsageLog(Base):
    """LLM调用使用记录表"""
    __tablename__ = "llm_usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="模型提供者ID")
    provider_name: Mapped[str] = mapped_column(String(200), nullable=True, comment="模型提供者名称")
    model: Mapped[str] = mapped_column(String(200), nullable=True, comment="模型名称")
    latency: Mapped[str] = mapped_column(String(20), nullable=True, comment="调用延迟")
    tokens: Mapped[int] = mapped_column(Integer, default=0, comment="Token消耗")
    cost: Mapped[str] = mapped_column(String(50), default="¥0.00", comment="调用费用")
    status: Mapped[str] = mapped_column(String(20), default="成功", comment="调用状态：成功/失败")
    called_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False, comment="调用时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
