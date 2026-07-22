"""引擎注册表 — 管理引擎类型与实例的创建"""

from typing import Optional

from .base import BaseEngine, EngineConfig, EngineType


class EngineRegistry:
    """引擎注册表

    支持注册自定义引擎类型，并根据名称创建引擎实例。

    用法:
        EngineRegistry.register("my_engine", MyEngine)
        engine = EngineRegistry.create("my_engine", config=...)
    """

    _engines: dict[str, type[BaseEngine]] = {}

    @classmethod
    def register(cls, engine_type: str | EngineType, engine_class: type[BaseEngine]):
        """注册引擎类"""
        key = engine_type.value if isinstance(engine_type, EngineType) else engine_type
        cls._engines[key] = engine_class

    @classmethod
    def create(
        cls,
        engine_type: str | EngineType,
        config: Optional[EngineConfig] = None,
        **kwargs,
    ) -> BaseEngine:
        """创建引擎实例"""
        key = engine_type.value if isinstance(engine_type, EngineType) else engine_type
        engine_class = cls._engines.get(key)
        if not engine_class:
            raise ValueError(
                f"未知引擎类型: '{key}'. "
                f"已注册: {list(cls._engines.keys())}"
            )
        return engine_class(config=config, **kwargs)

    @classmethod
    def list_types(cls) -> list[str]:
        """列出所有已注册的引擎类型"""
        return list(cls._engines.keys())

    @classmethod
    def unregister(cls, engine_type: str | EngineType):
        """注销引擎类型"""
        key = engine_type.value if isinstance(engine_type, EngineType) else engine_type
        cls._engines.pop(key, None)
