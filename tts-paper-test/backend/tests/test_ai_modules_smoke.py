"""
AI 新模块端到端冒烟测试
========================
覆盖三个新模块：
1. App 自动化（/api/v1/app-test）：设备/用例/执行/截图对比/崩溃日志 CRUD + 执行
2. 通用测试任务（/api/v1/ai-test-tasks）：5 类型任务 CRUD + 执行器（模拟路径）
3. 数据工厂（/api/v1/data-factory）：生成器列表 / 数据生成 / 历史记录

执行器真实网络请求路径不在此覆盖（需外部目标服务），仅验证模拟路径。
"""

import pytest

pytestmark = pytest.mark.asyncio


# ════════════ App 自动化 ════════════


async def test_app_device_flow(async_client, auth_headers):
    """设备管理：创建 → 列表 → 更新 → 删除"""
    # 创建
    resp = await async_client.post(
        "/api/v1/app-test/devices",
        headers=auth_headers,
        json={"name": "华为P60", "os": "Android", "version": "14.0"},
    )
    assert resp.status_code == 200, resp.text
    device_id = resp.json()["data"]["id"]
    assert resp.json()["data"]["status"] == "空闲"

    # 列表
    resp = await async_client.get("/api/v1/app-test/devices", headers=auth_headers)
    assert resp.json()["data"]["total"] == 1

    # 更新状态
    resp = await async_client.put(
        f"/api/v1/app-test/devices/{device_id}",
        headers=auth_headers,
        json={"status": "占用"},
    )
    assert resp.json()["data"]["status"] == "占用"

    # 删除
    resp = await async_client.delete(
        f"/api/v1/app-test/devices/{device_id}", headers=auth_headers
    )
    assert resp.json()["success"] is True


async def test_app_execution_run_flow(async_client, auth_headers):
    """远程执行：创建 → 执行（状态流转）→ 结果落库"""
    # 创建用例
    resp = await async_client.post(
        "/api/v1/app-test/test-cases",
        headers=auth_headers,
        json={"name": "登录流程", "platform": "iOS", "priority": "P0"},
    )
    assert resp.status_code == 200, resp.text

    # 创建执行
    resp = await async_client.post(
        "/api/v1/app-test/executions",
        headers=auth_headers,
        json={"name": "App冒烟执行", "device": "iPhone 15", "cases_count": 8},
    )
    assert resp.status_code == 200, resp.text
    exec_id = resp.json()["data"]["id"]
    assert resp.json()["data"]["status"] == "待执行"

    # 执行
    resp = await async_client.post(
        f"/api/v1/app-test/executions/{exec_id}/run", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] in ("完成", "失败")
    assert data["pass_rate"] >= 0
    assert data["result"]["summary"]["total"] == 8


async def test_app_screenshot_and_crash(async_client, auth_headers):
    """截图对比 + 崩溃分析"""
    # 截图对比
    resp = await async_client.post(
        "/api/v1/app-test/screenshot-diffs",
        headers=auth_headers,
        json={
            "page": "登录页",
            "device": "华为P60",
            "result": "差异",
            "similarity": 92.5,
        },
    )
    assert resp.status_code == 200, resp.text
    diff_id = resp.json()["data"]["id"]
    resp = await async_client.get(
        "/api/v1/app-test/screenshot-diffs", headers=auth_headers
    )
    assert resp.json()["data"]["total"] == 1
    await async_client.delete(
        f"/api/v1/app-test/screenshot-diffs/{diff_id}", headers=auth_headers
    )

    # 崩溃日志
    resp = await async_client.post(
        "/api/v1/app-test/crash-logs",
        headers=auth_headers,
        json={"crash_type": "NullPointerException", "device": "小米14", "count": 5},
    )
    assert resp.status_code == 200, resp.text
    crash_id = resp.json()["data"]["id"]
    resp = await async_client.get("/api/v1/app-test/crash-logs", headers=auth_headers)
    assert resp.json()["data"]["total"] == 1
    await async_client.delete(
        f"/api/v1/app-test/crash-logs/{crash_id}", headers=auth_headers
    )


# ════════════ 通用测试任务 ════════════


async def test_task_crud_and_execute(async_client, auth_headers):
    """任务：创建（合法/非法 module）→ 列表过滤 → 执行 → 结果"""
    # 非法 module 拒绝
    resp = await async_client.post(
        "/api/v1/ai-test-tasks",
        headers=auth_headers,
        json={"task_type": "performance", "module": "hack-me", "name": "x"},
    )
    assert resp.json()["success"] is False

    # 创建性能任务（模拟路径，无 URL）
    resp = await async_client.post(
        "/api/v1/ai-test-tasks",
        headers=auth_headers,
        json={
            "task_type": "performance",
            "module": "perf-scenario",
            "name": "登录接口压测",
            "config": {"concurrency": 5},
        },
    )
    assert resp.status_code == 200, resp.text
    task_id = resp.json()["data"]["id"]
    assert resp.json()["data"]["status"] == "待执行"

    # 创建安全任务
    resp = await async_client.post(
        "/api/v1/ai-test-tasks",
        headers=auth_headers,
        json={
            "task_type": "security",
            "module": "sec-targets",
            "name": "主站扫描",
            "config": {},
        },
    )
    assert resp.json()["success"] is True
    sec_id = resp.json()["data"]["id"]

    # 列表按类型过滤
    resp = await async_client.get(
        "/api/v1/ai-test-tasks",
        headers=auth_headers,
        params={"task_type": "performance"},
    )
    assert resp.json()["data"]["total"] == 1

    # 执行性能任务
    resp = await async_client.post(
        f"/api/v1/ai-test-tasks/{task_id}/execute", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] == "完成"
    assert data["result"]["summary"]["requests"] == 5

    # 执行安全任务（模拟路径）
    resp = await async_client.post(
        f"/api/v1/ai-test-tasks/{sec_id}/execute", headers=auth_headers
    )
    assert resp.json()["data"]["status"] == "完成"
    assert "vuln_found" in resp.json()["data"]["result"]["summary"]

    # 删除
    resp = await async_client.delete(
        f"/api/v1/ai-test-tasks/{task_id}", headers=auth_headers
    )
    assert resp.json()["success"] is True


async def test_task_five_types_valid(async_client, auth_headers):
    """5 个类型的合法 module 均可创建"""
    valid = {
        "performance": "perf-scenario",
        "security": "sec-rules",
        "compatibility": "compat-matrix",
        "regression": "reg-cases",
        "exploratory": "exp-target",
    }
    for t, m in valid.items():
        resp = await async_client.post(
            "/api/v1/ai-test-tasks",
            headers=auth_headers,
            json={"task_type": t, "module": m, "name": f"{t}任务"},
        )
        assert resp.json()["success"] is True, f"{t} 创建失败: {resp.text}"
    # 不传类型返回全部
    resp = await async_client.get("/api/v1/ai-test-tasks", headers=auth_headers)
    assert resp.json()["data"]["total"] == len(valid)


# ════════════ 数据工厂 ════════════


async def test_data_factory_generate_flow(async_client, auth_headers):
    """数据工厂：生成器列表 → 生成数据 → 历史记录 → 删除"""
    # 生成器列表
    resp = await async_client.get(
        "/api/v1/data-factory/generators", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    generators = resp.json()["data"]
    assert len(generators) == 11
    keys = {g["key"] for g in generators}
    assert {
        "cn_name",
        "phone",
        "email",
        "id_card",
        "bank_card",
        "hk_id",
        "license",
        "geo",
        "username",
        "company",
        "address",
    } <= keys

    # 生成中文姓名 5 条
    resp = await async_client.post(
        "/api/v1/data-factory/generate",
        headers=auth_headers,
        json={"generator": "cn_name", "count": 5},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert len(data["rows"]) == 5
    assert all(len(r["value"]) in (2, 3) for r in data["rows"])
    assert resp.json()["message"].startswith("已生成 5 条")

    # 生成身份证（校验 18 位 + 合法校验位）
    resp = await async_client.post(
        "/api/v1/data-factory/generate",
        headers=auth_headers,
        json={"generator": "id_card", "count": 3},
    )
    ids = [r["value"] for r in resp.json()["data"]["rows"]]
    assert all(len(i) == 18 for i in ids)

    # 未知生成器拒绝
    resp = await async_client.post(
        "/api/v1/data-factory/generate",
        headers=auth_headers,
        json={"generator": "not-exist", "count": 1},
    )
    assert resp.json()["success"] is False

    # 历史记录
    resp = await async_client.get("/api/v1/data-factory/logs", headers=auth_headers)
    assert resp.json()["data"]["total"] == 2

    # 删除历史
    log_id = resp.json()["data"]["items"][0]["id"]
    resp = await async_client.delete(
        f"/api/v1/data-factory/logs/{log_id}", headers=auth_headers
    )
    assert resp.json()["success"] is True
