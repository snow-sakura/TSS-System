"""
引擎抽象层测试
- MockEngine: 基本执行流程
- EngineRegistry: 注册与实例化
- EngineConfig: 配置参数
"""
import pytest
from engines.base import BaseEngine, EngineConfig, ExploreResult, TestCaseResult, StepResult
from engines.registry import EngineRegistry
from engines.mock_engine import MockEngine


class TestEngineConfig:
    """EngineConfig 数据模型"""

    def test_default_values(self):
        config = EngineConfig()
        assert config.model_name == ""
        assert config.api_key == ""
        assert config.base_url == ""
        assert config.model_family == ""
        assert config.additional_params == {}

    def test_custom_values(self):
        config = EngineConfig(
            model_name="gpt-4",
            api_key="sk-test",
            base_url="https://test.com/v1",
            model_family="openai",
            additional_params={"temperature": 0.5},
        )
        assert config.model_name == "gpt-4"
        assert config.api_key == "sk-test"
        assert config.base_url == "https://test.com/v1"
        assert config.model_family == "openai"
        assert config.additional_params["temperature"] == 0.5


class TestMockEngine:
    """MockEngine 基本行为"""

    @pytest.mark.asyncio
    async def test_initialize(self):
        engine = MockEngine()
        result = await engine.initialize()
        assert result is True

    @pytest.mark.asyncio
    async def test_explore_basic(self):
        engine = MockEngine()
        result = await engine.explore("https://example.com", "test login page")
        assert isinstance(result, ExploreResult)
        assert result.url == "https://example.com"
        assert result.title  # 非空
        assert len(result.steps) > 0

    @pytest.mark.asyncio
    async def test_execute_test_case_success(self):
        engine = MockEngine(success_rate=1.0)  # 100% 通过
        result = await engine.execute_test_case(
            url="https://example.com/login",
            test_steps=["点击登录按钮", "输入用户名", "输入密码"],
        )
        assert isinstance(result, TestCaseResult)
        assert result.passed is True
        assert result.steps  # 有步骤记录

    @pytest.mark.asyncio
    async def test_execute_test_case_failure(self):
        engine = MockEngine(success_rate=0.0)  # 100% 失败
        result = await engine.execute_test_case(
            url="https://example.com/login",
            test_steps=["点击登录按钮"],
        )
        assert isinstance(result, TestCaseResult)
        assert result.passed is False
        assert result.error  # 有错误信息

    @pytest.mark.asyncio
    async def test_execute_tool_call(self):
        engine = MockEngine()
        result = await engine.execute_tool("click", {"selector": "#login-btn"})
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_cleanup(self):
        engine = MockEngine()
        result = await engine.cleanup()
        assert result is True

    @pytest.mark.asyncio
    async def test_health_check(self):
        engine = MockEngine()
        status = await engine.health_check()
        assert status["status"] == "healthy"
        assert status["engine_type"] == "mock"

    @pytest.mark.asyncio
    async def test_explore_with_focus_element(self):
        """验证 explore 接受 focus_element 参数"""
        engine = MockEngine()
        result = await engine.explore(
            "https://example.com",
            "search feature",
            focus_element="#search-box",
        )
        assert result.url == "https://example.com"

    @pytest.mark.asyncio
    async def test_engine_type_property(self):
        engine = MockEngine()
        assert engine.engine_type == "mock"

    @pytest.mark.asyncio
    async def test_concurrent_execution(self):
        """MockEngine 可以并发执行"""
        engine = MockEngine()
        results = await asyncio.gather(
            engine.execute_test_case("https://a.com", ["step1"]),
            engine.execute_test_case("https://b.com", ["step2"]),
            engine.execute_test_case("https://c.com", ["step3"]),
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
        with pytest.raises(ValueError, match="Unknown engine type"):
            EngineRegistry.create("nonexistent")

    def test_double_register(self):
        """重复注册应覆盖"""
        EngineRegistry.register("mock", MockEngine)
        EngineRegistry.register("mock", MockEngine)  # 不应报错
        assert EngineRegistry.get("mock") == MockEngine

    def test_get_engine_class(self):
        EngineRegistry.register("mock", MockEngine)
        cls = EngineRegistry.get("mock")
        assert cls == MockEngine

    def test_get_nonexistent(self):
        with pytest.raises(KeyError):
            EngineRegistry.get("nonexistent")

    def test_list_when_empty(self):
        EngineRegistry._engines.clear()
        assert EngineRegistry.list_types() == []


# 需要 asyncio 用于并发测试
import asyncio
