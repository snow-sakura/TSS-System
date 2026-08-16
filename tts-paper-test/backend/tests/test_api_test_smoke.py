"""
AI接口自动化模块端到端冒烟测试
=============================
覆盖链路：
  项目创建/列表 → 环境配置 CRUD → 接口 CRUD → 用例 CRUD/过滤 → 执行记录 → 报告生成
（真实网络请求类端点 /test 与 /execute 的后台真实执行不在此覆盖，需本地服务）
"""

import pytest

from services import api_test_service as ats
from sqlalchemy import select

from models.api_test import ApiTestProject, ApiExecution

pytestmark = pytest.mark.asyncio


# ── 链路一：项目 + 接口端点 ──


async def test_project_and_endpoint_flow(async_client, auth_headers):
    # 1. 创建项目
    resp = await async_client.post(
        "/api/v1/api-test/projects",
        headers=auth_headers,
        json={
            "name": "售票系统",
            "base_url": "https://tss.example.com",
            "description": "冒烟项目",
        },
    )
    assert resp.status_code == 200, resp.text
    project_id = resp.json()["data"]["id"]

    # 2. 项目列表
    resp = await async_client.get("/api/v1/api-test/projects", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["total"] == 1

    # 3. 项目详情
    resp = await async_client.get(
        f"/api/v1/api-test/projects/{project_id}", headers=auth_headers
    )
    assert resp.json()["data"]["name"] == "售票系统"

    # 4. 创建接口
    resp = await async_client.post(
        "/api/v1/api-test/endpoints",
        headers=auth_headers,
        json={
            "project_id": project_id,
            "name": "用户登录",
            "method": "post",
            "url": "https://tss.example.com/api/auth/login",
            "headers": {"Content-Type": "application/json"},
        },
    )
    assert resp.status_code == 200, resp.text
    endpoint_id = resp.json()["data"]["id"]
    assert resp.json()["data"]["method"] == "POST"  # 方法自动大写

    # 5. 接口列表（含项目名）
    resp = await async_client.get("/api/v1/api-test/endpoints", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["project_name"] == "售票系统"

    # 6. 更新接口
    resp = await async_client.put(
        f"/api/v1/api-test/endpoints/{endpoint_id}",
        headers=auth_headers,
        json={"name": "用户登录（新）"},
    )
    assert resp.json()["data"]["name"] == "用户登录（新）"

    # 7. 删除接口
    resp = await async_client.delete(
        f"/api/v1/api-test/endpoints/{endpoint_id}", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text


# ── 链路二：环境配置 CRUD ──


async def test_environment_flow(async_client, auth_headers):
    resp = await async_client.post(
        "/api/v1/api-test/environments",
        headers=auth_headers,
        json={
            "name": "测试环境",
            "base_url": "https://test-api.tss.local",
            "auth_type": "JWT Token",
        },
    )
    assert resp.status_code == 200, resp.text
    env_id = resp.json()["data"]["id"]
    assert resp.json()["data"]["status"] == "未连接"

    resp = await async_client.get("/api/v1/api-test/environments", headers=auth_headers)
    assert resp.json()["data"]["total"] == 1

    resp = await async_client.put(
        f"/api/v1/api-test/environments/{env_id}",
        headers=auth_headers,
        json={"auth_type": "OAuth2"},
    )
    assert resp.json()["data"]["auth_type"] == "OAuth2"

    resp = await async_client.delete(
        f"/api/v1/api-test/environments/{env_id}", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text


# ── 链路三：用例 CRUD + 过滤 + 执行记录 + 报告 ──


async def test_case_execution_report_flow(async_client, db_session, auth_headers):
    # 准备数据
    resp = await async_client.post(
        "/api/v1/api-test/projects",
        headers=auth_headers,
        json={"name": "用例项目", "base_url": "https://tss.example.com"},
    )
    project_id = resp.json()["data"]["id"]

    for i, name in enumerate(["登录成功验证", "登录失败验证", "用户列表分页"]):
        resp = await async_client.post(
            "/api/v1/api-test/test-cases",
            headers=auth_headers,
            json={
                "project_id": project_id,
                "name": name,
                "method": "GET",
                "url": f"https://tss.example.com/api/case/{i}",
                "expected_status": 200,
                "priority": "P1",
                "source": "AI生成",
            },
        )
        assert resp.status_code == 200, resp.text

    # 列表（不传过滤）
    resp = await async_client.get("/api/v1/api-test/test-cases", headers=auth_headers)
    assert resp.json()["data"]["total"] == 3

    # 按项目过滤
    resp = await async_client.get(
        "/api/v1/api-test/test-cases",
        headers=auth_headers,
        params={"project_id": project_id},
    )
    assert resp.json()["data"]["total"] == 3

    # 按状态过滤（默认全部"待执行"）
    resp = await async_client.get(
        "/api/v1/api-test/test-cases",
        headers=auth_headers,
        params={"status": "待执行"},
    )
    assert resp.json()["data"]["total"] == 3
    resp = await async_client.get(
        "/api/v1/api-test/test-cases",
        headers=auth_headers,
        params={"status": "通过"},
    )
    assert resp.json()["data"]["total"] == 0

    # 更新用例（来源/优先级）
    case_id = (
        resp.json()["data"]["items"][0]["id"] if resp.json()["data"]["items"] else None
    )
    if case_id is None:
        resp = await async_client.get(
            "/api/v1/api-test/test-cases",
            headers=auth_headers,
            params={"status": "待执行"},
        )
        case_id = resp.json()["data"]["items"][0]["id"]
    resp = await async_client.put(
        f"/api/v1/api-test/test-cases/{case_id}",
        headers=auth_headers,
        json={"priority": "P0"},
    )
    assert resp.json()["data"]["priority"] == "P0"

    # service 层创建执行记录（避免启动后台真实请求）
    exec_obj = await ats.create_execution(
        db_session, project_id, [case_id], user_id=999
    )
    assert exec_obj.status == "执行中"

    # 执行记录列表 API
    resp = await async_client.get(
        "/api/v1/api-test/executions",
        headers=auth_headers,
        params={"project_id": project_id},
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["case_ids"] == [case_id]
    assert items[0]["project_name"] == "用例项目"

    # 执行详情 API
    resp = await async_client.get(
        f"/api/v1/api-test/executions/{exec_obj.id}", headers=auth_headers
    )
    assert resp.json()["data"]["id"] == exec_obj.id

    # 模拟执行完成 → 生成报告
    exec_obj.status = "完成"
    exec_obj.total = 3
    exec_obj.passed = 2
    exec_obj.failed = 1
    exec_obj.pass_rate = 66.7
    exec_obj.results = [
        {"case_id": 1, "name": "登录成功验证", "passed": True},
        {"case_id": 2, "name": "登录失败验证", "passed": True},
        {"case_id": 3, "name": "用户列表分页", "passed": False},
    ]
    await db_session.commit()

    resp = await async_client.post(
        "/api/v1/api-test/reports/generate",
        headers=auth_headers,
        json={"project_id": project_id, "report_type": "回归报告"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["pass_rate"] == 66.7

    # 报告列表
    resp = await async_client.get("/api/v1/api-test/reports", headers=auth_headers)
    assert resp.json()["data"]["total"] == 1
    assert resp.json()["data"]["items"][0]["project_name"] == "用例项目"


# ── 链路四：删除项目级联清理 ──


async def test_delete_project_cascade(async_client, db_session, auth_headers):
    resp = await async_client.post(
        "/api/v1/api-test/projects",
        headers=auth_headers,
        json={"name": "待删项目", "base_url": "https://tss.example.com"},
    )
    project_id = resp.json()["data"]["id"]

    resp = await async_client.post(
        "/api/v1/api-test/endpoints",
        headers=auth_headers,
        json={
            "project_id": project_id,
            "name": "待删接口",
            "method": "GET",
            "url": "https://tss.example.com/api/x",
        },
    )
    assert resp.status_code == 200, resp.text

    resp = await async_client.delete(
        f"/api/v1/api-test/projects/{project_id}", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text

    # 项目详情应为 404（异常处理：ValueError → 422 也可接受，检查列表为空）
    resp = await async_client.get("/api/v1/api-test/projects", headers=auth_headers)
    assert resp.json()["data"]["total"] == 0

    # 接口同步清空
    resp = await async_client.get("/api/v1/api-test/endpoints", headers=auth_headers)
    assert resp.json()["data"]["total"] == 0
