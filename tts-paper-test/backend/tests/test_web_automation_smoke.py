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

pytestmark = pytest.mark.asyncio


# ── 链路一：项目 + 探索落库 + 对象库 ──


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
