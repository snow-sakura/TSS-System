"""
需求分析AI Agent - 流式SSE输出Markdown格式分析结果
"""
import json
from typing import AsyncGenerator
from .base_agent import BaseAgent
from core.logging_config import get_logger

logger = get_logger("requirement_agent")


class RequirementAnalysisStreamAgent(BaseAgent):
    """
    需求分析流式Agent
    输入需求内容（文档提取文本 or 手动输入）
    以SSE流式输出Markdown格式的完整分析报告
    """

    SYSTEM_PROMPT = """你是一位资深的软件需求分析专家。你的任务是对用户提供的需求内容进行全面、深入的分析。

请严格按照以下Markdown格式输出分析报告（这是固定的输出格式，必须遵守）：

---

## 📋 需求概述

[用2-3句话概括需求的整体范围和目标]

---

## 🎯 功能点分析

| 功能点 | 描述 | 优先级 | 分类 |
|--------|------|--------|------|
| [功能点名称] | [简要描述] | P0/P1/P2 | [核心功能/辅助功能/优化功能] |
| ... | ... | ... | ... |

---

## 📝 业务规则

1. **[规则名称]**: [规则详细说明]
2. **[规则名称]**: [规则详细说明]
...

---

## ⚠️ 潜在风险与约束

| 风险/约束 | 类型 | 影响 | 建议 |
|-----------|------|------|------|
| [风险描述] | 技术/业务/安全 | [影响范围] | [缓解建议] |
| ... | ... | ... | ... |

---

## 💡 优化建议

1. **[建议标题]**: [详细建议说明]
2. **[建议标题]**: [详细建议说明]
...

---

## 🏷️ 需求标签

`标签1` `标签2` `标签3` ...

---

## 📊 分析总结

[对需求的整体评估，包括复杂度、完整性、可测试性等方面的评价]
"""

    def __init__(self, name: str = "requirement-agent", **kwargs):
        super().__init__(name=name, **kwargs)
        # 从settings读取默认配置
        from config import get_settings
        settings = get_settings()
        if not self.api_key:
            self.api_key = settings.OPENAI_API_KEY
        if not self.base_url:
            self.base_url = settings.OPENAI_BASE_URL
        if not self.model_name:
            self.model_name = settings.DEFAULT_LLM_MODEL

    async def run(self, *args, **kwargs):
        """实现基类抽象方法 - 包装 analyze_stream """
        async for chunk in self.analyze_stream(*args, **kwargs):
            pass  # 流式场景下直接使用 analyze_stream
        return {"status": "done"}

    async def analyze_stream(self, content: str, requirement_name: str = "") -> AsyncGenerator[str, None]:
        """
        流式分析需求内容
        逐块 yield markdown 文本
        """
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )

        prompt = f"""请对以下需求内容进行全面分析：

## 需求名称
{requirement_name or "未命名需求"}

## 需求内容
{content}

请按照固定Markdown格式输出分析报告。"""

        logger.info(f"[{self.name}] 开始流式分析: {requirement_name or '未命名'}")

        try:
            stream = await client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=4096,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        yield delta.content

        except Exception as e:
            error_msg = f"\n\n> ❌ AI分析过程出错: {str(e)}"
            logger.error(f"[{self.name}] 分析失败: {e}")
            yield error_msg
