"""
Web自动化模块端到端冒烟测试
=========================
覆盖本次改动链路：
  项目创建 → 探索落库(元素同步) → 对象库 API → 用例创建/审批 → 执行记录(一对多+标题)
"""

import asyncio
import tempfile
from pathlib import Path

import pytest
import pytest_asyncio

from services import web_automation_service as was
from services.web_automation_service import SCREENSHOTS_DIR, persist_screenshot


# ── 链路一：项目 + 探索落库 + 对象库 ──


@pytest.mark.asyncio
async def test_project_and_object_repo_flow(async_client, db_session, auth_headers):
    # 1. 创建项目
    resp = await async_client.post(
        "/api/v1/web-automation/projects",
        headers=auth_headers,
        json={"name": "冒烟项目", "target_url": "https://example.com"},
    )
    assert resp.status_code == 200, resp.text
    project_id = resp.json()["data"]["id"]

    # 2. 模拟探索落库（含元素）→ 自动同步元素对象
    page = await was.upsert_page(
        db_session,
        project_id,
        {
            "url": "https://example.com/login",
            "title": "登录页",
            "elements": [
                {
                    "name": "用户名",
                    "type": "input",
                    "placeholder": "请输入用户名",
                    "selector": "#username",
                },
                {
                    "name": "登录按钮",
                    "type": "button",
                    "text": "登录",
                    "selector": "button.login",
                },
                {"form": True, "placeholder": "登录表单", "type": "form"},
            ],
        },
    )
    page_id = page.id

    # 3. 对象库 API：页面列表含元素统计
    resp = await async_client.get(
        f"/api/v1/web-automation/projects/{project_id}/object-repo",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    repo = resp.json()["data"]
    assert len(repo) == 1
    assert repo[0]["element_count"] == 3, repo[0]

    # 4. 元素列表 API
    resp = await async_client.get(
        f"/api/v1/web-automation/pages/{page_id}/elements", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    names = {e["name"] for e in resp.json()["data"]}
    assert names == {"用户名", "登录按钮", "表单-登录表单"}, names

    # 5. 手动添加/更新/删除元素
    resp = await async_client.post(
        f"/api/v1/web-automation/pages/{page_id}/elements",
        headers=auth_headers,
        json={
            "name": "记住我",
            "element_type": "checkbox",
            "locator": "#remember",
            "description": "记住登录状态",
        },
    )
    assert resp.status_code == 200, resp.text
    elem_id = resp.json()["data"]["id"]

    resp = await async_client.put(
        f"/api/v1/web-automation/ui-elements/{elem_id}",
        headers=auth_headers,
        json={"description": "记住登录状态（已更新）"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["description"] == "记住登录状态（已更新）"

    resp = await async_client.delete(
        f"/api/v1/web-automation/ui-elements/{elem_id}", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text

    # 6. 完整性校验：元素数量回到 3
    resp = await async_client.get(
        f"/api/v1/web-automation/projects/{project_id}/object-repo",
        headers=auth_headers,
    )
    assert resp.json()["data"][0]["element_count"] == 3


# ── 链路二：用例创建/审批 + 执行记录(一对多) ──


@pytest.mark.asyncio
async def test_testcase_and_execution_flow(async_client, db_session, auth_headers):
    resp = await async_client.post(
        "/api/v1/web-automation/projects",
        headers=auth_headers,
        json={"name": "用例项目", "target_url": "https://example.com"},
    )
    project_id = resp.json()["data"]["id"]

    # 创建两条用例（手动）
    case_ids = []
    for i, title in enumerate(["登录成功", "登录失败提示"], start=1):
        resp = await async_client.post(
            f"/api/v1/web-automation/projects/{project_id}/test-cases",
            headers=auth_headers,
            json={
                "title": title,
                "steps": [
                    {
                        "action": "打开页面",
                        "target": "https://example.com/login",
                        "value": "",
                    }
                ],
                "expected_result": "符合预期",
            },
        )
        assert resp.status_code == 200, resp.text
        case_ids.append(resp.json()["data"]["id"])

    # 审批两条用例
    for cid in case_ids:
        resp = await async_client.post(
            f"/api/v1/web-automation/test-cases/{cid}/approve", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text

    # 执行记录（service 层，避免启动真实执行引擎）
    exec_obj = await was.create_execution(db_session, project_id, case_ids, user_id=999)
    detailed = await was.get_execution(db_session, exec_obj.id)
    from schemas.web_automation import ExecutionResponse

    payload = ExecutionResponse.model_validate(detailed).model_dump()
    assert payload["execution_case_ids"] == case_ids, payload["execution_case_ids"]
    assert payload["case_titles"] == ["登录成功", "登录失败提示"], payload[
        "case_titles"
    ]

    # 执行记录列表 API 含标题
    resp = await async_client.get(
        f"/api/v1/web-automation/projects/{project_id}/executions", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["data"]["items"]
    assert items[0]["execution_case_ids"] == case_ids
    assert items[0]["case_titles"] == ["登录成功", "登录失败提示"]


# ── 链路三：截图持久化 ──


@pytest.mark.asyncio
async def test_persist_screenshot_flow():
    # 临时文件 → uploads/screenshots → basename
    with tempfile.NamedTemporaryFile(suffix="_smoke.png", delete=False) as f:
        f.write(b"fake-png")
        tmp = f.name
    try:
        name = persist_screenshot(tmp)
        assert name == Path(tmp).name, name
        assert (SCREENSHOTS_DIR / name).exists()
        # 幂等
        assert persist_screenshot(tmp) == name
        (SCREENSHOTS_DIR / name).unlink()
    finally:
        Path(tmp).unlink(missing_ok=True)


# ── 链路四：定位策略体系（P0-a1） ──


def test_infer_locator_type():
    from services.web_automation_service import infer_locator_type

    assert infer_locator_type("//button[@id='x']", {}) == "xpath"
    assert infer_locator_type("xpath=//div", {}) == "xpath"
    assert infer_locator_type("text=登录", {}) == "text"
    assert infer_locator_type("id=login-btn", {}) == "id"
    assert infer_locator_type("name=username", {}) == "name"
    assert infer_locator_type("#login-btn", {}) == "css"
    assert infer_locator_type("button.login", {}) == "css"
    assert infer_locator_type("", {}) == "css"
    assert infer_locator_type("", {}) == "css"  # 空/None 兜底


def test_build_backup_locators():
    from services.web_automation_service import build_backup_locators

    attrs = {
        "id": "login",
        "name": "user",
        "placeholder": "请输入账号",
        "text": "登录按钮",
    }
    backups = build_backup_locators("#login", attrs)
    assert "#login" not in backups  # 与主定位相同则跳过
    assert "//*[@id='login']" in backups
    assert "[name='user']" in backups
    assert "[placeholder='请输入账号']" in backups
    assert len(backups) <= 5


@pytest.mark.asyncio
async def test_element_crud_with_locator_strategy(db_session):
    """对象库元素 CRUD 支持完整定位策略字段"""
    from schemas.web_automation import ProjectCreate

    project = await was.create_project(
        db_session,
        ProjectCreate(name="定位策略项目", target_url="https://example.com"),
        user_id=999,
    )
    page = await was.upsert_page(
        db_session,
        project.id,
        {"url": "https://example.com/login", "title": "登录页", "elements": []},
    )

    elem = await was.create_ui_element(
        db_session,
        project.id,
        page.id,
        {
            "name": "用户名输入框",
            "element_type": "input",
            "locator": "#username",
            "locator_type": "css",
            "backup_locators": ["[name='username']", "//input[@id='username']"],
            "wait_timeout": 8,
            "force_action": True,
        },
    )
    assert elem.locator_type == "css"
    assert elem.backup_locators == ["[name='username']", "//input[@id='username']"]
    assert elem.wait_timeout == 8
    assert elem.force_action is True

    # 更新
    updated = await was.update_ui_element(
        db_session, elem.id, {"locator_type": "xpath", "force_action": False}
    )
    assert updated.locator_type == "xpath"
    assert updated.force_action is False
    assert updated.wait_timeout == 8  # 未改动字段保持


@pytest.mark.asyncio
async def test_sync_page_elements_infers_locator_strategy(db_session):
    """探索落库自动推断定位策略 + 生成备用链"""
    from schemas.web_automation import ProjectCreate

    project = await was.create_project(
        db_session,
        ProjectCreate(name="同步策略项目", target_url="https://example.com"),
        user_id=999,
    )
    page = await was.upsert_page(
        db_session,
        project.id,
        {"url": "https://example.com/login", "title": "登录页", "elements": []},
    )

    raw = [
        {
            "name": "登录按钮",
            "type": "button",
            "selector": "//button[@id='submit']",
            "id": "submit",
            "text": "登录",
        },
        {"name": "搜索框", "type": "input", "selector": "#search", "id": "search"},
        {"name": "记住我", "type": "checkbox", "selector": "text=记住我"},
    ]
    await was.sync_page_elements(db_session, page.id, project.id, raw)

    from sqlalchemy import select
    from models.web_automation import WebUIElement

    result = await db_session.execute(
        select(WebUIElement).where(WebUIElement.page_id == page.id)
    )
    elems = {e.name: e for e in result.scalars().all()}

    btn = elems["登录按钮"]
    assert btn.locator_type == "xpath", btn.locator_type
    assert "//*[@id='submit']" in (btn.backup_locators or [])

    search = elems["搜索框"]
    assert search.locator_type == "css"
    assert "#search" not in (search.backup_locators or [])

    chk = elems["记住我"]
    assert chk.locator_type == "text"

    # 幂等：再次同步不产生重复
    await was.sync_page_elements(db_session, page.id, project.id, raw)
    result = await db_session.execute(
        select(WebUIElement).where(WebUIElement.page_id == page.id)
    )
    assert len(result.scalars().all()) == 3


def test_generate_locate_code_structured_locator():
    """执行脚本生成：结构化定位 → Playwright 原生定位 + 备用链 + 强制操作"""
    from agents.execution_agent import ExecutionAgent

    agent = ExecutionAgent()
    code = agent._gen_structured_code(
        {
            "action": "aiTap",
            "target": "登录按钮",
            "locator": "#submit",
            "locator_type": "css",
            "backup_locators": ["//button[@id='submit']", "[name='submit']"],
            "wait_timeout": 8,
            "force_action": True,
        },
        3,
        "click",
    )
    assert code is not None
    assert "waitAndLocate(page, strategies, 8000)" in code
    assert '"type": "css"' in code and '"type": "xpath"' in code
    assert "clickEl(el, true)" in code
    assert "step: 3" in code

    # 无 locator → None（回退 AI 视觉）
    assert (
        agent._gen_structured_code({"action": "aiTap", "target": "x"}, 1, "click")
        is None
    )


def test_generate_structured_assertion():
    """执行脚本生成：结构化断言（visible/text/attribute/url + 默认可见）"""
    from agents.execution_agent import ExecutionAgent

    agent = ExecutionAgent()
    code = agent._gen_structured_code(
        {
            "action": "断言",
            "target": "登录按钮",
            "locator": "#submit",
            "locator_type": "css",
            "assertions": [
                {"type": "visible"},
                {"type": "text", "expected": "登录"},
                {"type": "attribute", "attribute": "class", "expected": "btn-primary"},
                {"type": "url", "expected": "/login"},
            ],
        },
        2,
        "assert",
    )
    assert code is not None
    assert "action: 'assert'" in code
    assert "const assertionResults = [];" in code
    assert "await assertOn(el, { type: 'visible'" in code
    assert "type: 'text', expected: '登录'" in code
    assert "type: 'attribute', expected: 'btn-primary', attribute: 'class'" in code
    assert "await assertUrl(page, '/login');" in code
    # 逐条断言收集结果：成功 push passed，失败捕获记录，最后统一判定
    assert "assertionResults.push" in code
    assert "passed: false" in code
    assert "const failedAssertions = assertionResults.filter(r => !r.passed);" in code
    assert "assertion_results: assertionResults" in code

    # 无 assertions → 默认等待元素可见
    fallback = agent._gen_structured_code(
        {"action": "断言", "target": "x", "locator": "#x", "wait_timeout": 6},
        1,
        "assert",
    )
    assert fallback is not None
    assert "el.waitFor({ state: 'visible', timeout: 6000 })" in fallback


# ── 方向A：步骤级明细 + 断言结果可视化链路 ──


@pytest.mark.asyncio
async def test_mock_engine_assertion_results():
    """Mock 引擎逐条产出断言明细（type/expected/attribute/actual/passed），失败即步骤失败"""
    from engines.mock_engine import MockEngine

    engine = MockEngine()
    engine.pass_rate = 1.0
    events: list[dict] = []

    async def cb(msg: dict):
        events.append(msg)

    case = {
        "id": 42,
        "title": "断言用例",
        "steps": [
            {
                "action": "点击",
                "target": "登录按钮",
                "locator": "#submit",
                "locator_type": "css",
                "assertions": [
                    {"type": "visible"},
                    {"type": "text", "expected": "登录"},
                    {
                        "type": "attribute",
                        "attribute": "class",
                        "expected": "btn-primary",
                    },
                ],
            },
            {"action": "输入", "target": "用户名", "value": "admin"},
        ],
    }
    result = await engine.execute_test_case(case, callback=cb)

    assert result.status == "passed"
    assert len(result.steps) == 2

    # 第一个步骤：3 条断言明细
    step1 = result.steps[0]
    assert len(step1.assertion_results) == 3
    assert [a["type"] for a in step1.assertion_results] == [
        "visible",
        "text",
        "attribute",
    ]
    assert step1.assertion_results[1]["expected"] == "登录"
    assert step1.assertion_results[2]["attribute"] == "class"
    assert all(isinstance(a.get("passed"), bool) for a in step1.assertion_results)
    assert all("actual" in a for a in step1.assertion_results)

    # 第二个步骤：无断言 → 空明细
    assert result.steps[1].assertion_results == []

    # step 事件携带定位器与断言明细（供前端实时展示）
    step_events = [e for e in events if e.get("type") == "step"]
    assert len(step_events) == 2
    assert step_events[0]["locator"] == "#submit"
    assert step_events[0]["locator_type"] == "css"
    assert len(step_events[0]["assertion_results"]) == 3
    assert step_events[1]["assertion_results"] == []


@pytest.mark.asyncio
async def test_execution_step_results_persisted(db_session, async_client, auth_headers):
    """执行记录持久化步骤级明细，ExecutionResponse 序列化带 step_results"""
    from schemas.web_automation import ExecutionResponse

    resp = await async_client.post(
        "/api/v1/web-automation/projects",
        headers=auth_headers,
        json={"name": "步骤明细项目", "target_url": "https://example.com"},
    )
    project_id = resp.json()["data"]["id"]
    resp = await async_client.post(
        f"/api/v1/web-automation/projects/{project_id}/test-cases",
        headers=auth_headers,
        json={
            "title": "登录",
            "steps": [{"action": "打开页面", "target": "https://example.com"}],
        },
    )
    case_id = resp.json()["data"]["id"]

    exec_obj = await was.create_execution(
        db_session, project_id, [case_id], user_id=999
    )
    step_results = [
        {
            "case_id": case_id,
            "case_title": "登录",
            "status": "completed",
            "duration_ms": 1200,
            "steps": [
                {
                    "step": 1,
                    "action": "tap",
                    "target": "登录按钮",
                    "locator": "#submit",
                    "locator_type": "css",
                    "status": "passed",
                    "duration_ms": 350,
                    "assertion_results": [
                        {
                            "type": "visible",
                            "expected": "",
                            "actual": "visible",
                            "passed": True,
                        },
                        {
                            "type": "text",
                            "expected": "登录",
                            "actual": "登录",
                            "passed": False,
                        },
                    ],
                },
                {
                    "step": 2,
                    "action": "输入",
                    "target": "用户名",
                    "status": "passed",
                    "duration_ms": 400,
                },
            ],
        }
    ]
    await was.update_execution(db_session, exec_obj.id, {"step_results": step_results})

    # DB 层持久化
    fresh = await was.get_execution(db_session, exec_obj.id)
    assert fresh.step_results == step_results

    # API 序列化带 step_results
    payload = ExecutionResponse.model_validate(fresh).model_dump()
    assert payload["step_results"] == step_results

    # 列表 API 也返回
    resp = await async_client.get(
        f"/api/v1/web-automation/projects/{project_id}/executions", headers=auth_headers
    )
    items = resp.json()["data"]["items"]
    assert items[0]["step_results"] == step_results
    step = items[0]["step_results"][0]["steps"][0]
    assert step["locator"] == "#submit"
    failed = step["assertion_results"][1]
    assert (
        failed["passed"] is False
        and failed["expected"] == "登录"
        and failed["actual"] == "登录"
    )
