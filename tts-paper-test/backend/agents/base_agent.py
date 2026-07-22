"""Agent基类"""

from abc import ABC, abstractmethod
from typing import Optional
from core.logging_config import get_logger


class BaseAgent(ABC):
    """AI Agent基类"""

    def __init__(self, name: str, model_name: str = None, api_key: str = None, base_url: str = None):
        self.name = name
        self.model_name = model_name
        self.api_key = api_key
        self.base_url = base_url
        self.logger = get_logger(name)

    @abstractmethod
    async def run(self, *args, **kwargs):
        """执行Agent任务"""
        pass

    async def call_llm(self, prompt: str, system_prompt: str = None) -> str:
        """调用LLM (通过OpenAI兼容API)"""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        self.logger.info(f"[{self.name}] 调用LLM: {self.model_name}")

        response = await client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=0.7,
        )

        content = response.choices[0].message.content
        self.logger.debug(f"[{self.name}] LLM响应: {content[:200]}...")
        return content
