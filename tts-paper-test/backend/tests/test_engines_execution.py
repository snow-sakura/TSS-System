"""方向 B 测试 — 多引擎真实执行接入

覆盖:
- BrowserUseEngine: 依赖懒加载、步骤转自然语言、健康检查（mock browser_use）
- UITarsEngine: one-shot HTTP 调用、步骤转自然语言、失败检测、健康检查（mock httpx）
- 执行路由: _run_execution 按引擎路由、_case_result_to_dict 结构转换
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engines.base import EngineConfig, StepResult, TestCaseResult
from engines.browser_use_engine import BrowserUseEngine
from engines.ui_tars_engine import UITarsEngine


# ── BrowserUseEngine ──


class TestBrowserUseEngine:
    """Browser Use 引擎（依赖懒加载 + mock 模块）"""

    def test_health_check_without_deps(self):
        """未安装 browser-use 时 health_check 返回不可用与安装指引"""
        engine = BrowserUseEngine()
        with patch.dict("sys.modules", {"browser_use": None}):
            status = asyncio.run(engine.health_check())
        assert status["engine"] == "browser_use"
        assert status["available"] is False
        assert "browser-use 未安装" in status["error"]

    @pytest.mark.asyncio
    async def test_health_check_with_deps(self):
        """安装 browser-use 后 health_check 可用"""
        fake = MagicMock()
        with patch.dict("sys.modules", {"browser_use": fake}):
            status = await BrowserUseEngine().health_check()
        assert status["available"] is True
        assert status["model"] == "qwen3.7-plus"

    def test_step_to_text_mapping(self):
        """结构化步骤 → 自然语言指令"""
        engine = BrowserUseEngine()
        assert (
            engine._step_to_text(1, "navigate", "https://a.com", "")
            == "1. 导航到 https://a.com"
        )
        assert (
            engine._step_to_text(2, "click", "登录按钮", "")
            == "2. 点击元素「登录按钮」"
        )
        assert (
            engine._step_to_text(3, "type", "用户名", "admin")
            == "3. 在「用户名」输入文本「admin」"
        )
        assert (
            engine._step_to_text(4, "assert", "欢迎语", "")
            == "4. 断言页面上存在「欢迎语」"
        )
        assert (
            engine._step_to_text(5, "unknown_action", "x", "") == "5. unknown_action: x"
        )
        assert engine._step_to_text(6, "unknown_action", "", "") == ""

    @pytest.mark.asyncio
    async def test_execute_test_case_maps_history(self):
        """Agent 执行历史映射为 TestCaseResult（success → passed）"""
        engine = BrowserUseEngine()
        fake = MagicMock()
        fake.ChatOpenAI = MagicMock(return_value=object())
        fake.Browser = MagicMock(return_value=MagicMock())
        fake.Agent = MagicMock(return_value=AsyncMock())

        history = SimpleNamespace(
            is_successful=lambda: True,
            final_result=lambda: "执行完成",
            urls=lambda: ["https://a.com"],
            action_names=lambda: ["click", "type"],
            errors=lambda: [None],
            number_of_steps=lambda: 2,
        )
        fake.Agent.return_value.run = AsyncMock(return_value=history)
        fake.Browser.return_value.close = AsyncMock()

        with patch.dict("sys.modules", {"browser_use": fake}):
            result = await engine.execute_test_case(
                {
                    "id": 1,
                    "title": "登录",
                    "page_url": "https://a.com",
                    "steps": [{"action": "click", "target": "登录"}],
                }
            )

        assert result.case_id == 1
        assert result.status == "passed"
        assert len(result.steps) == 2
        assert result.steps[0].action == "click"

    @pytest.mark.asyncio
    async def test_execute_test_case_failure(self):
        """Agent 失败 → 用例 failed 并带错误信息"""
        engine = BrowserUseEngine()
        fake = MagicMock()
        fake.ChatOpenAI = MagicMock(return_value=object())
        fake.Browser = MagicMock(return_value=MagicMock())
        fake.Agent = MagicMock(return_value=AsyncMock())

        history = SimpleNamespace(
            is_successful=lambda: False,
            final_result=lambda: "",
            urls=lambda: [],
            action_names=lambda: ["click"],
            errors=lambda: [None, "元素未找到"],
            number_of_steps=lambda: 2,
        )
        fake.Agent.return_value.run = AsyncMock(return_value=history)
        fake.Browser.return_value.close = AsyncMock()

        with patch.dict("sys.modules", {"browser_use": fake}):
            result = await engine.execute_test_case(
                {
                    "id": 2,
                    "title": "登录失败",
                    "page_url": "https://a.com",
                    "steps": [{"action": "click", "target": "登录"}],
                }
            )

        assert result.status == "failed"
        assert "元素未找到" in result.error

    @pytest.mark.asyncio
    async def test_execute_missing_deps_raises_clear_error(self):
        """未安装依赖时执行抛清晰错误（而非 NotImplementedError）"""
        engine = BrowserUseEngine()
        with patch.dict("sys.modules", {"browser_use": None}):
            with pytest.raises(RuntimeError, match="browser-use 未安装"):
                await engine.execute_test_case(
                    {
                        "id": 1,
                        "title": "x",
                        "steps": [{"action": "click", "target": "y"}],
                    }
                )


# ── UITarsEngine ──


class TestUITarsEngine:
    """UI-TARS 引擎（HTTP one-shot 调用）"""

    def test_oneshot_url(self):
        engine = UITarsEngine()
        assert engine._oneshot_url() == "http://127.0.0.1:3000/api/v1/oneshot/query"

        engine2 = UITarsEngine(
            EngineConfig(extra={"base_url": "http://localhost:8080"})
        )
        assert engine2._oneshot_url() == "http://localhost:8080/api/v1/oneshot/query"

    def test_step_to_text_mapping(self):
        engine = UITarsEngine()
        assert (
            engine._step_to_text(1, "navigate", "https://a.com", "")
            == "1. 导航到 https://a.com"
        )
        assert (
            engine._step_to_text(2, "click", "登录按钮", "")
            == "2. 点击元素「登录按钮」"
        )
        assert (
            engine._step_to_text(3, "type", "用户名", "admin")
            == "3. 在「用户名」输入文本「admin」"
        )

    def test_detect_failure(self):
        """从 Agent 输出检测失败标记"""
        engine = UITarsEngine()
        assert engine._detect_failure("页面加载失败") is True
        assert engine._detect_failure("元素 not found") is True
        assert engine._detect_failure("执行超时") is True
        assert engine._detect_failure("登录成功，欢迎回来") is False
        assert engine._detect_failure("") is False

    @pytest.mark.asyncio
    async def test_execute_test_case_success(self):
        """one-shot 返回成功 → passed"""
        engine = UITarsEngine()

        async def fake_post(url, json=None, headers=None):
            return SimpleNamespace(
                status_code=200,
                json=lambda: {"sessionId": "s1", "result": "登录成功，欢迎回来"},
            )

        with patch("engines.ui_tars_engine.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=SimpleNamespace(post=fake_post)
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await engine.execute_test_case(
                {
                    "id": 3,
                    "title": "登录",
                    "page_url": "https://a.com",
                    "steps": [{"action": "click", "target": "登录按钮"}],
                }
            )

        assert result.case_id == 3
        assert result.status == "passed"
        assert result.duration_ms >= 0
        assert len(result.steps) == 1

    @pytest.mark.asyncio
    async def test_execute_test_case_failure_detected(self):
        """one-shot 返回含失败标记 → failed"""
        engine = UITarsEngine()

        async def fake_post(url, json=None, headers=None):
            return SimpleNamespace(
                status_code=200,
                json=lambda: {"sessionId": "s2", "result": "点击失败：元素未找到"},
            )

        with patch("engines.ui_tars_engine.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=SimpleNamespace(post=fake_post)
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await engine.execute_test_case(
                {
                    "id": 4,
                    "title": "登录",
                    "page_url": "https://a.com",
                    "steps": [{"action": "click", "target": "登录按钮"}],
                }
            )

        assert result.status == "failed"
        assert "失败" in result.error

    @pytest.mark.asyncio
    async def test_execute_http_error(self):
        """服务不可达 → 清晰错误（而非 NotImplementedError）"""
        engine = UITarsEngine()

        import httpx

        async def fake_post(url, json=None, headers=None):
            raise httpx.ConnectError("connection refused")

        with patch("engines.ui_tars_engine.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=SimpleNamespace(post=fake_post)
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await engine.execute_test_case(
                {
                    "id": 5,
                    "title": "登录",
                    "page_url": "https://a.com",
                    "steps": [{"action": "click", "target": "登录按钮"}],
                }
            )

        assert result.status == "failed"
        assert "无法连接 UI-TARS 服务" in result.error

    @pytest.mark.asyncio
    async def test_health_check_unreachable(self):
        """服务不可达 → 不可用"""
        engine = UITarsEngine()

        import httpx

        async def fake_get(url):
            raise httpx.ConnectError("refused")

        with patch("engines.ui_tars_engine.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=SimpleNamespace(get=fake_get)
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            status = await engine.health_check()

        assert status["available"] is False
        assert "请启动 UI-TARS Desktop" in status["error"]

    @pytest.mark.asyncio
    async def test_health_check_reachable(self):
        """服务可达 → 可用"""
        engine = UITarsEngine()

        async def fake_get(url):
            return SimpleNamespace(status_code=200)

        with patch("engines.ui_tars_engine.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=SimpleNamespace(get=fake_get)
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            status = await engine.health_check()

        assert status["available"] is True
        assert status["base_url"] == "http://127.0.0.1:3000"


# ── 执行路由与结果转换 ──


class TestExecutionRouting:
    """_run_execution 引擎路由与 TestCaseResult → dict 转换"""

    @pytest.mark.asyncio
    async def test_case_result_to_dict_includes_steps_and_assertions(self):
        """TestCaseResult 转换保留步骤、定位器与断言明细"""
        from api.web_automation import _case_result_to_dict

        result = TestCaseResult(
            case_id=10,
            case_title="登录",
            status="passed",
            duration_ms=1234,
            steps=[
                StepResult(
                    step=1,
                    action="click",
                    target="登录按钮",
                    status="passed",
                    duration_ms=500,
                    data={"locator": "#submit", "locator_type": "css"},
                    assertion_results=[
                        {
                            "type": "text",
                            "expected": "登录",
                            "attribute": "",
                            "actual": "登录",
                            "passed": True,
                        }
                    ],
                ),
                StepResult(step=2, action="type", target="用户名", status="passed"),
            ],
        )

        d = _case_result_to_dict(result)
        assert d["case_id"] == 10
        assert d["status"] == "passed"
        assert len(d["steps"]) == 2
        assert d["steps"][0]["locator"] == "#submit"
        assert d["steps"][0]["locator_type"] == "css"
        assert d["steps"][0]["assertion_results"][0]["passed"] is True
        assert d["steps"][1]["assertion_results"] == []

    @pytest.mark.asyncio
    async def test_run_execution_routes_to_mock_engine(self):
        """_run_execution 按默认引擎(mock)路由执行，并持久化 step_results"""
        from api import web_automation as wa

        captured = {}

        async def fake_update_execution(db, execution_id, updates):
            captured.update(updates)

        async def fake_update_project_status(db, project_id, status):
            captured["project_status"] = status

        async def fake_broadcast(project_id, message):
            captured["broadcast"] = message

        with (
            patch.object(wa.was, "update_execution", new=fake_update_execution),
            patch.object(
                wa.was, "update_project_status", new=fake_update_project_status
            ),
            patch.object(wa, "broadcast_to_project", new=fake_broadcast),
            patch("services.execution_engine.get_default_engine", return_value="mock"),
            patch("database.AsyncSessionLocal"),
        ):
            from engines.base import TestCaseResult, StepResult

            class FakeEngine:
                """鸭子类型引擎：模拟 mock 引擎逐步执行并触发 step 事件"""

                async def execute_test_suite(self, cases, callback=None):
                    assert callback is not None
                    for c in cases:
                        await callback(
                            {
                                "type": "step",
                                "step": 1,
                                "action": "click",
                                "target": "登录",
                                "status": "passed",
                            }
                        )
                    return [
                        TestCaseResult(
                            case_id=cases[0]["id"],
                            case_title=cases[0]["title"],
                            status="passed",
                            duration_ms=100,
                            steps=[
                                StepResult(
                                    step=1,
                                    action="click",
                                    target="登录",
                                    status="passed",
                                )
                            ],
                        )
                    ]

                async def cleanup(self):
                    pass

            fake_engine = FakeEngine()

            with patch("engines.get_engine", return_value=fake_engine):
                await wa._run_execution(
                    project_id=1,
                    execution_id=99,
                    test_cases=[
                        {
                            "id": 10,
                            "title": "登录",
                            "page_url": "https://a.com",
                            "steps": [{"action": "click", "target": "登录"}],
                        }
                    ],
                    user_id=1,
                    engine_type="mock",
                )

        assert captured["status"] == "completed"
        assert captured["project_status"] == "completed"
        step_results = captured["step_results"]
        assert step_results[0]["case_id"] == 10
        assert step_results[0]["status"] == "passed"
        assert step_results[0]["steps"][0]["action"] == "click"
        assert captured["broadcast"]["type"] == "execution_complete"
        assert captured["broadcast"]["engine"] == "mock"

    @pytest.mark.asyncio
    async def test_run_execution_engine_error_marks_failed(self):
        """引擎抛错 → 执行记录 failed + 广播 execution_error"""
        from api import web_automation as wa

        captured = {}

        async def fake_update_execution(db, execution_id, updates):
            captured.update(updates)

        async def fake_update_project_status(db, project_id, status):
            captured["project_status"] = status

        async def fake_broadcast(project_id, message):
            captured["broadcast"] = message

        class BoomEngine:
            async def execute_test_suite(self, cases, callback=None):
                raise RuntimeError("引擎崩溃")

            async def cleanup(self):
                pass

        with (
            patch.object(wa.was, "update_execution", new=fake_update_execution),
            patch.object(
                wa.was, "update_project_status", new=fake_update_project_status
            ),
            patch.object(wa, "broadcast_to_project", new=fake_broadcast),
            patch("database.AsyncSessionLocal"),
            patch("engines.get_engine", return_value=BoomEngine()),
        ):
            await wa._run_execution(
                project_id=1,
                execution_id=100,
                test_cases=[{"id": 1, "title": "x", "steps": []}],
                user_id=1,
                engine_type="browser_use",
            )

        assert captured["status"] == "failed"
        assert "引擎崩溃" in captured["error_message"]
        assert captured["project_status"] == "failed"
        assert captured["broadcast"]["type"] == "execution_error"
        assert captured["broadcast"]["engine"] == "browser_use"

    def test_execute_request_supports_engine_field(self):
        """ExecuteRequest 支持 engine 字段（后端已接受前端传递）"""
        from schemas.web_automation import ExecuteRequest

        req = ExecuteRequest(case_ids=[1, 2], engine="browser_use")
        assert req.engine == "browser_use"

        req_default = ExecuteRequest()
        assert req_default.case_ids is None
        assert req_default.engine is None
