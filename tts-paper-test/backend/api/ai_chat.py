"""AI聊天端点 - 智能助手对话接口"""

import json
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from loguru import logger

from config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/v1/ai", tags=["AI智能助手"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    stream: bool = True


# 系统提示词 - 定义AI助手的角色和能力
SYSTEM_PROMPT = """你是TSS AI测试平台的智能助手，名为"TSS AI助手"。你的职责是帮助用户进行软件测试相关工作。

## 你的能力

### 1. 数据查询
- 查询测试用例、缺陷、报告、环境配置等项目数据
- 查询测试执行历史和结果
- 查询系统配置和状态

### 2. 操作执行
- 生成测试报告
- 分析缺陷根因
- 生成测试用例
- 执行健康检测

### 3. 咨询建议
- 提供测试策略建议
- 解答测试相关问题
- 推荐最佳实践
- 分析质量趋势

## 回复格式
- 使用中文回复
- 使用Markdown格式化内容
- 关键数据用**加粗**显示
- 列表使用-或1. 2. 3.格式
- 代码使用```代码块```
- 保持回复简洁专业

## 注意事项
- 如果用户询问具体数据，说明你需要查询后端API获取实时数据
- 如果用户请求操作，说明你可以协助生成报告或分析，但实际执行需要用户确认
- 保持专业友好的语气
"""


async def stream_chat_response(messages: List[dict], request: Request):
    """流式生成聊天回复"""
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
        )

        # 构建消息列表
        api_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in messages:
            api_messages.append({"role": msg["role"], "content": msg["content"]})

        # 流式调用LLM
        stream = await client.chat.completions.create(
            model=settings.DEFAULT_LLM_MODEL,
            messages=api_messages,
            stream=True,
            temperature=0.7,
            max_tokens=2000,
        )

        async for chunk in stream:
            if await request.is_disconnected():
                break

            if chunk.choices and chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                yield f"data: {json.dumps({'type': 'token', 'content': token}, ensure_ascii=False)}\n\n"

        # 发送完成信号
        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    except Exception as e:
        logger.error(f"AI聊天生成失败: {e}")
        error_msg = f"抱歉，AI服务暂时不可用。错误信息：{str(e)}"
        yield f"data: {json.dumps({'type': 'error', 'content': error_msg}, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(request: Request, chat_request: ChatRequest):
    """AI聊天接口 - 流式响应"""
    messages = [{"role": msg.role, "content": msg.content} for msg in chat_request.messages]

    return StreamingResponse(
        stream_chat_response(messages, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
