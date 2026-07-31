"""
引擎抽象层测试
- EngineConfig: 配置参数
- MockEngine: 探索 / 用例执行 / 用例生成 / 健康检查
- EngineRegistry: 注册与实例化
"""
import asyncio

import pytest

from engines.base import BaseEngine, EngineConfig, ExploreResult, TestCaseResult
from engines.registry import EngineRegistry
from engines.mock_engine import MockEngine


class TestEngineConfig:
    """EngineConfig 数据模型"""

    def test_default_values(self):
        config = EngineConfig()
        assert config.model_name == "qwen3.7-plus"
        assert config.api_key == ""
        assert config.base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"
        assert config.model_family == "qwen3"
        assert config.headless is True
        assert config.extra == {}

    def test_custom_values(self):
        config = EngineConfig(
            model_name="gpt-4",
            api_key="sk-test",
            base_url="https://test.com/v1",
            model_family="openai",
            headless=False,
            timeout_ms=60000,
            extra={"temperature": 0.5},
        )
        assert config.model_name == "gpt-4"
        assert config.api_key == "sk-test"
        assert config.base_url == "https://test.com/v1"
        assert config.model_family == "openai"
        assert config.headless is False
        assert config.extra["temperature"] == 0.5


class TestMockEngine:
    """MockEngine 基本行为"""

    @pytest.mark.asyncio
    async def test_explore_basic(self):
        engine = MockEngine()
        result = await engine.explore("https://example.com")
        assert isinstance(result, ExploreResult)
        assert result.url == "https://example.com"
        assert result.title  # 非空
        assert len(result.interactive_elements) > 0

    @pytest.mark.asyncio
    async def test_explore_with_callback(self):
        """探索过程中应回调进度事件"""
        engine = MockEngine()
        events = []
        async def on_event(ev: dict):
            events.append(ev)
        result = await engine.explore("https://example.com", callback=on_event)
        assert result.url == "https://example.com"
        assert len(events) >= 1
        assert events[0]["type"] == "status"

    @pytest.mark.asyncio
    async def test_execute_test_case_success(self):
        engine = MockEngine()
        engine.pass_rate = 1.0  # 100% 通过
        result = await engine.execute_test_case(
            {"id": 1, "title": "登录成功", "steps": [
                {"action": "click", "target": "登录按钮"},
                {"action": "type", "target": "用户名输入框", "value": "test_user"},
            ]},
        )
        assert isinstance(result, TestCaseResult)
        assert result.status == "passed"
        assert result.steps  # 有步骤记录

    @pytest.mark.asyncio
    async def test_execute_test_case_failure(self):
        engine = MockEngine()
        engine.pass_rate = 0.0  # 100% 失败
        result = await engine.execute_test_case(
            {"id": 2, "title": "登录失败", "steps": [{"action": "click", "target": "登录按钮"}]},
        )
        assert isinstance(result, TestCaseResult)
        assert result.status == "failed"
        assert result.error  # 有错误信息

    @pytest.mark.asyncio
    async def test_generate_test_cases(self):
        engine = MockEngine()
        cases = await engine.generate_test_cases("用户登录功能")
        assert isinstance(cases, list)
        assert len(cases) >= 2
        assert all("title" in c and "steps" in c for c in cases)

    @pytest.mark.asyncio
    async def test_health_check(self):
        engine = MockEngine()
        status = await engine.health_check()
        assert status["engine"] == "mock"
        assert status["available"] is True
        assert status["pass_rate"] == 0.85

    @pytest.mark.asyncio
    async def test_concurrent_execution(self):
        """MockEngine 可以并发执行"""
        engine = MockEngine()
        results = await asyncio.gather(
            engine.execute_test_case({"id": 1, "title": "a", "steps": [{"action": "click", "target": "x"}]}),
            engine.execute_test_case({"id": 2, "title": "b", "steps": [{"action": "click", "target": "y"}]}),
            engine.execute_test_case({"id": 3, "title": "c", "steps": [{"action": "click", "target": "z"}]}),
        )
        assert len(results) == 3
        for r in results:
            assert isinstance(r, TestCaseResult)


class TestEngineRegistry:
    """EngineRegistry 注册与实例化"""

    def setup_method(self):
        EngineRegistry._engines.clear()  # 重置注册表

    def test_register_and_list(self):
        EngineRegistry.register("mock", MockEngine)
        types = EngineRegistry.list_types()
        assert "mock" in types

    def test_create_instance(self):
        EngineRegistry.register("mock", MockEngine)
        config = EngineConfig(model_name="test-model")
        engine = EngineRegistry.create("mock", config)
        assert isinstance(engine, MockEngine)
        assert engine.config.model_name == "test-model"

    def test_create_unknown_type(self):
        with pytest.raises(ValueError, match="未知引擎类型"):
            EngineRegistry.create("nonexistent")

    def test_double_register(self):
        """重复注册应覆盖"""
        EngineRegistry.register("mock", MockEngine)
        EngineRegistry.register("mock", MockEngine)  # 不应报错
        assert len(EngineRegistry.list_types()) == 1

    def test_unregister(self):
        EngineRegistry.register("mock", MockEngine)
        EngineRegistry.unregister("mock")
        assert EngineRegistry.list_types() == []

    def test_list_when_empty(self):
        EngineRegistry._engines.clear()
        assert EngineRegistry.list_types() == []

    def test_registered_engines(self):
        """系统内置引擎应已注册（main 初始化后）"""
        from engines.midscene_engine import MidsceneEngine
        from engines.playwright_mcp_engine import PlaywrightMCPEngine
        from engines.browser_use_engine import BrowserUseEngine
        from engines.ui_tars_engine import UITarsEngine
        assert issubclass(MidsceneEngine, BaseEngine)
        assert issubclass(PlaywrightMCPEngine, BaseEngine)
        assert issubclass(BrowserUseEngine, BaseEngine)
        assert issubclass(UITarsEngine, BaseEngine)
