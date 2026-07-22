#!/usr/bin/env python3
"""
TSS AI测试平台 - 全面业务模块验证
自动启动/停止服务，验证API + 前端页面交互
"""
import subprocess
import time
import json
import sys
import os
import signal
import urllib.request
import urllib.error

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
API_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"

# 测试结果
results = []
passed = 0
failed = 0
warnings = 0

def log(test, status, detail=""):
    global passed, failed, warnings
    icon = {"pass": "✅", "fail": "❌", "warn": "⚠️"}.get(status, "?")
    print(f"{icon} {test}{f' - {detail}' if detail else ''}")
    results.append({"test": test, "status": status, "detail": detail})
    if status == "pass": passed += 1
    elif status == "fail": failed += 1
    elif status == "warn": warnings += 1

def api(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f"{API_URL}{path}", data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return {"status": resp.status, "data": json.loads(resp.read())}
    except Exception as e:
        return {"status": 0, "error": str(e)}

def wait_for_server(url, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except:
            time.sleep(1)
    return False

def start_servers():
    print("启动服务...")
    backend_dir = os.path.join(BASE_DIR, "backend")
    # 后端
    backend_proc = subprocess.Popen(
        [os.path.join(backend_dir, ".venv/bin/python"), "-m", "uvicorn", "main:app",
         "--host", "0.0.0.0", "--port", "8000", "--log-level", "warning"],
        cwd=backend_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    # 前端
    frontend_proc = subprocess.Popen(
        ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"],
        cwd=FRONTEND_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(2)
    return backend_proc, frontend_proc

def stop_servers(backend_proc, frontend_proc):
    for p in [backend_proc, frontend_proc]:
        try:
            p.terminate()
            p.wait(timeout=5)
        except:
            p.kill()

def run_playwright_tests():
    """运行Playwright前端测试"""
    test_script = os.path.join(BASE_DIR, "backend", "scripts", "full-module-test.mjs")
    if os.path.exists(test_script):
        result = subprocess.run(
            ["node", test_script],
            cwd=os.path.join(BASE_DIR, "backend"), capture_output=True, text=True, timeout=180
        )
        # 解析输出
        for line in result.stdout.split("\n"):
            if "✅" in line:
                name = line.split("✅")[1].split("-")[0].strip() if "✅" in line else ""
                if name:
                    log(f"[前端] {name}", "pass")
            elif "❌" in line:
                name = line.split("❌")[1].split("-")[0].strip() if "❌" in line else ""
                detail = line.split("-")[-1].strip() if "-" in line else ""
                if name:
                    log(f"[前端] {name}", "fail", detail)
    else:
        log("Playwright测试脚本", "warn", "未找到测试脚本")

def main():
    global passed, failed, warnings

    backend_proc, frontend_proc = start_servers()

    try:
        # 等待服务启动
        print("等待服务启动...")
        if not wait_for_server(f"{API_URL}/docs"):
            log("后端服务启动", "fail", "无法连接")
            return
        log("后端服务启动", "pass")

        if not wait_for_server(FRONTEND_URL):
            log("前端服务启动", "fail", "无法连接")
            return
        log("前端服务启动", "pass")

        # ==================== Part 1: API接口验证 ====================
        print("\n═══════════════════════════════════════")
        print("Part 1: API接口验证")
        print("═══════════════════════════════════════\n")

        # 1.1 认证
        print("--- 1.1 认证模块 ---")
        r = api("POST", "/api/v1/auth/login", {"username": "admin", "password": "admin123"})
        token = r.get("data", {}).get("data", {}).get("access_token")
        log("[API] 登录", "pass" if token else "fail")

        r = api("GET", "/api/v1/auth/profile", token=token)
        log("[API] 用户信息", "pass" if r["status"] == 200 else "fail")

        # 1.2 用户管理
        print("\n--- 1.2 用户管理 ---")
        for name, path in [
            ("用户列表", "/api/v1/users?page=1&page_size=5"),
            ("角色列表", "/api/v1/users/roles/list"),
            ("登录日志", "/api/v1/users/login-logs?page=1&page_size=5"),
            ("设备列表", "/api/v1/users/devices?page=1&page_size=5"),
        ]:
            r = api("GET", path, token=token)
            log(f"[API] {name}", "pass" if r["status"] == 200 else "fail")

        # 1.3 测试生命周期
        print("\n--- 1.3 测试生命周期 ---")
        for name, path in [
            ("需求列表", "/api/v1/test-lifecycle/requirements?page=1&page_size=5"),
            ("测试用例", "/api/v1/test-lifecycle/test-cases?page=1&page_size=5"),
            ("执行记录", "/api/v1/test-lifecycle/executions?page=1&page_size=5"),
            ("缺陷列表", "/api/v1/test-lifecycle/defects?page=1&page_size=5"),
            ("报告列表", "/api/v1/test-lifecycle/reports?page=1&page_size=5"),
        ]:
            r = api("GET", path, token=token)
            log(f"[API] {name}", "pass" if r["status"] == 200 else "fail")

        # 1.4 AI Web自动化
        print("\n--- 1.4 AI Web自动化 ---")
        for name, path in [
            ("项目列表", "/api/v1/web-automation/projects?page=1"),
            ("项目列表(工作流)", "/api/v1/web-automation/projects-for-workflow"),
        ]:
            r = api("GET", path, token=token)
            log(f"[API] {name}", "pass" if r["status"] == 200 else "fail")

        # 1.5 工作流编排
        print("\n--- 1.5 工作流编排 ---")
        r = api("GET", "/api/v1/workflows?page=1&page_size=5", token=token)
        log("[API] 工作流列表", "pass" if r["status"] == 200 else "fail")

        r = api("POST", "/api/v1/workflows", {"name": "验证工作流", "description": "测试"}, token=token)
        wf_id = r.get("data", {}).get("id")
        log("[API] 创建工作流", "pass" if wf_id else "fail")

        if wf_id:
            r = api("PUT", f"/api/v1/workflows/{wf_id}/canvas", {
                "nodes": [
                    {"type": "start", "label": "开始", "config": {}, "position_x": 80, "position_y": 120},
                    {"type": "end", "label": "结束", "config": {}, "position_x": 300, "position_y": 120},
                ],
                "edges": [{"source_node_id": 0, "target_node_id": 1}],
            }, token=token)
            log("[API] 保存画布", "pass" if r.get("data", {}).get("ok") else "fail")

            r = api("GET", f"/api/v1/workflows/{wf_id}", token=token)
            nodes = r.get("data", {}).get("nodes", [])
            log("[API] 工作流详情", "pass" if len(nodes) == 2 else "fail", f"nodes={len(nodes)}")

        # 1.6 知识库
        print("\n--- 1.6 知识库 ---")
        for name, path in [
            ("测试模式库", "/api/v1/knowledge/test-patterns?page=1&page_size=5"),
            ("Bug知识库", "/api/v1/knowledge/bug-knowledge?page=1&page_size=5"),
        ]:
            r = api("GET", path, token=token)
            log(f"[API] {name}", "pass" if r["status"] == 200 else "fail")

        # 1.7 基础配置
        print("\n--- 1.7 基础配置 ---")
        for name, path in [
            ("环境配置", "/api/v1/config/environments?page=1&page_size=5"),
            ("LLM配置", "/api/v1/config/llm-providers?page=1&page_size=5"),
            ("提示词配置", "/api/v1/config/prompts?page=1&page_size=5"),
            ("操作日志", "/api/v1/config/operation-logs?page=1&page_size=5"),
        ]:
            r = api("GET", path, token=token)
            log(f"[API] {name}", "pass" if r["status"] == 200 else "fail")

        # 1.8 AI对话
        print("\n--- 1.8 AI对话 ---")
        r = api("POST", "/api/v1/ai/chat", {"messages": [{"role": "user", "content": "你好"}], "stream": False}, token=token)
        log("[API] AI对话", "pass" if r["status"] == 200 else "fail")

        # ==================== Part 2: 前端页面验证 ====================
        print("\n═══════════════════════════════════════")
        print("Part 2: 前端页面交互验证")
        print("═══════════════════════════════════════\n")

        # 运行Playwright测试
        run_playwright_tests()

        # ==================== 测试报告 ====================
        print("\n═══════════════════════════════════════")
        print("测试报告")
        print("═══════════════════════════════════════")
        total = passed + failed + warnings
        print(f"总计: {total} 项")
        print(f"通过: {passed} 项 ✅")
        print(f"失败: {failed} 项 ❌")
        print(f"警告: {warnings} 项 ⚠️")
        print(f"通过率: {passed > 0 and round(passed / (passed + failed) * 100) or 0}%")

        if failed > 0:
            print("\n失败项:")
            for r in results:
                if r["status"] == "fail":
                    print(f"  ❌ {r['test']}: {r['detail']}")

    finally:
        stop_servers(backend_proc, frontend_proc)
        print("\n服务已停止")

    return failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
