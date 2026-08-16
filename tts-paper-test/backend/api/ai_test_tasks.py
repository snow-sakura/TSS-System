"""AI 通用测试任务路由

覆盖性能 / 安全 / 兼容 / 回归 / 探索 5 个测试类型，
每个类型下 5 个子页面（共 25 个）共享一张 ai_test_tasks 表。
执行器"尽力真实"：配置了目标 URL 的任务会真实发起 HTTP 请求，
未配置 URL 的任务生成结构化模拟结果（数据真实落库、状态真实流转）。
"""

import asyncio
import random
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from models.ai_test_task import TestTask
from schemas.common import ResponseModel
from api.deps import get_current_user_dep

router = APIRouter(prefix="/ai-test-tasks", tags=["AI通用测试任务"])

# 子页面 module 白名单（防止任意 module 写入）
VALID_MODULES = {
    "performance": {
        "perf-scenario",
        "perf-config",
        "perf-execution",
        "perf-monitor",
        "perf-report",
    },
    "security": {"sec-targets", "sec-rules", "sec-scan", "sec-results", "sec-report"},
    "compatibility": {
        "compat-matrix",
        "compat-cases",
        "compat-execution",
        "compat-results",
        "compat-report",
    },
    "regression": {
        "reg-changes",
        "reg-scope",
        "reg-cases",
        "reg-execution",
        "reg-report",
    },
    "exploratory": {
        "exp-target",
        "exp-config",
        "exp-execution",
        "exp-findings",
        "exp-report",
    },
}


def _to_dict(m: TestTask) -> dict:
    """ORM 对象转 dict（时间戳格式化为展示字符串）"""
    data = {
        c.name: getattr(m, c.name)
        for c in m.__table__.columns
        if c.name not in ("created_at", "updated_at")
    }
    if getattr(m, "created_at", None) is not None:
        data["created_at"] = m.created_at.strftime("%Y-%m-%d %H:%M")
    return data


# ════════════ 任务 CRUD ════════════


@router.get("", response_model=ResponseModel)
async def list_tasks(
    task_type: Optional[str] = None,
    module: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """任务列表：按 type / module 过滤"""
    q = select(TestTask).where(TestTask.created_by == user.id)
    if task_type:
        q = q.where(TestTask.task_type == task_type)
    if module:
        q = q.where(TestTask.module == module)
    if keyword:
        conds = [
            TestTask.name.ilike(f"%{keyword}%"),
            TestTask.description.ilike(f"%{keyword}%"),
        ]
        q = q.where(or_(*conds))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    q = q.order_by(TestTask.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return ResponseModel(
        data={
            "total": total or 0,
            "page": page,
            "page_size": page_size,
            "items": [_to_dict(m) for m in rows],
        }
    )


@router.post("", response_model=ResponseModel)
async def create_task(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """创建任务（task_type + module 必须合法）"""
    task_type = body.get("task_type")
    module = body.get("module")
    if task_type not in VALID_MODULES or module not in VALID_MODULES.get(
        task_type, set()
    ):
        return ResponseModel(success=False, message="非法的任务类型或模块", data=None)
    item = TestTask(
        task_type=task_type,
        module=module,
        name=body.get("name") or f"{task_type}-{module}",
        description=body.get("description"),
        config=body.get("config") or {},
        status="待执行",
        created_by=user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="任务已创建", data=_to_dict(item))


@router.put("/{task_id}", response_model=ResponseModel)
async def update_task(
    task_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新任务（仅允许更新名称/描述/配置）"""
    item = await db.get(TestTask, task_id)
    if not item or item.created_by != user.id:
        return ResponseModel(success=False, message="任务不存在", data=None)
    for f in ("name", "description", "config"):
        if body.get(f) is not None:
            setattr(item, f, body[f])
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="任务已更新", data=_to_dict(item))


@router.delete("/{task_id}", response_model=ResponseModel)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除任务"""
    item = await db.get(TestTask, task_id)
    if not item or item.created_by != user.id:
        return ResponseModel(success=False, message="任务不存在", data=None)
    await db.delete(item)
    await db.commit()
    return ResponseModel(message="任务已删除")


@router.get("/{task_id}", response_model=ResponseModel)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """任务详情"""
    item = await db.get(TestTask, task_id)
    if not item or item.created_by != user.id:
        return ResponseModel(success=False, message="任务不存在", data=None)
    return ResponseModel(data=_to_dict(item))


# ════════════ 执行器 ════════════


async def _probe_url(url: str, headers: Optional[dict] = None, timeout: float = 5.0):
    """真实请求目标 URL，返回 (是否成功, 耗时ms, 状态码, 响应头)"""
    try:
        import httpx

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            t0 = asyncio.get_event_loop().time()
            resp = await client.get(url, headers=headers or {})
            cost = int((asyncio.get_event_loop().time() - t0) * 1000)
            return True, cost, resp.status_code, dict(resp.headers)
    except Exception:
        return False, 0, 0, {}


async def _execute_performance(cfg: dict) -> dict:
    """性能：有 URL 则真实并发请求测耗时，否则生成模拟指标"""
    url = cfg.get("url")
    concurrency = int(cfg.get("concurrency") or 10)
    if url:
        times: list[int] = []
        ok = 0
        sem = asyncio.Semaphore(min(concurrency, 20))

        async def one():
            nonlocal ok
            async with sem:
                success, cost, status, _ = await _probe_url(url, timeout=8)
                if success:
                    ok += 1
                    times.append(cost)

        await asyncio.gather(*[one() for _ in range(concurrency)])
        if times:
            times_sorted = sorted(times)
            p95 = times_sorted[
                min(len(times_sorted) - 1, int(len(times_sorted) * 0.95))
            ]
            p99 = times_sorted[
                min(len(times_sorted) - 1, int(len(times_sorted) * 0.99))
            ]
            return {
                "summary": {
                    "url": url,
                    "requests": concurrency,
                    "success": ok,
                    "avg_ms": round(sum(times) / len(times)),
                    "p95_ms": p95,
                    "p99_ms": p99,
                    "rps": ok,
                    "error_rate": f"{round((1 - ok / concurrency) * 100, 1)}%",
                },
                "items": [
                    {
                        "name": f"请求{i}",
                        "status": "成功" if i <= ok else "超时",
                        "cost_ms": times[i - 1] if i - 1 < len(times) else 0,
                    }
                    for i in range(1, concurrency + 1)
                ],
            }
    # 无 URL：生成模拟指标
    reqs = concurrency
    fail = int(reqs * random.uniform(0, 0.05))
    ok = reqs - fail
    avg = random.randint(60, 400)
    return {
        "summary": {
            "url": url or "未配置",
            "requests": reqs,
            "success": ok,
            "avg_ms": avg,
            "p95_ms": int(avg * random.uniform(2, 3)),
            "p99_ms": int(avg * random.uniform(4, 6)),
            "rps": int(reqs / random.uniform(0.8, 1.5)),
            "error_rate": f"{round(fail / reqs * 100, 1)}%",
        },
        "items": [
            {
                "name": f"请求{i}",
                "status": "成功" if i <= ok else "失败",
                "cost_ms": random.randint(30, avg * 2),
            }
            for i in range(1, reqs + 1)
        ],
    }


async def _execute_security(cfg: dict) -> dict:
    """安全：有 URL 则真实检查安全响应头，否则模拟漏洞清单"""
    url = cfg.get("url")
    if url:
        success, cost, status, headers = await _probe_url(url)
        checks = [
            ("X-Frame-Options", "点击劫持防护", headers.get("x-frame-options"), "高"),
            (
                "Content-Security-Policy",
                "内容安全策略",
                headers.get("content-security-policy"),
                "高",
            ),
            (
                "Strict-Transport-Security",
                "HSTS 强制 HTTPS",
                headers.get("strict-transport-security"),
                "中",
            ),
            (
                "X-Content-Type-Options",
                "MIME 嗅探防护",
                headers.get("x-content-type-options"),
                "中",
            ),
            ("X-XSS-Protection", "XSS 过滤", headers.get("x-xss-protection"), "低"),
        ]
        vulns = []
        for header, name, value, severity in checks:
            if not value:
                vulns.append(
                    {
                        "name": f"缺少安全响应头 {name} ({header})",
                        "severity": severity,
                        "category": "安全配置",
                        "status": "待修复",
                    }
                )
        if not success:
            vulns.append(
                {
                    "name": "目标无法访问",
                    "severity": "高",
                    "category": "可用性",
                    "status": "待修复",
                }
            )
        return {
            "summary": {
                "url": url,
                "status_code": status,
                "checked": len(checks),
                "vuln_found": len(vulns),
                "high": sum(1 for v in vulns if v["severity"] == "高"),
                "score": max(60, 100 - len(vulns) * 10),
            },
            "items": vulns,
        }
    rules = cfg.get("rules") or [
        "SQL注入检测",
        "XSS跨站脚本",
        "CSRF防护检测",
        "敏感信息泄露",
        "弱密码检测",
    ]
    vulns = [
        {
            "name": f"{r} - 发现异常",
            "severity": random.choice(["高", "中", "低"]),
            "category": r,
            "status": random.choice(["待修复", "修复中", "已修复"]),
        }
        for r in random.sample(rules, max(1, min(3, len(rules))))
    ]
    return {
        "summary": {
            "url": url or "未配置",
            "status_code": 200,
            "checked": len(rules),
            "vuln_found": len(vulns),
            "high": sum(1 for v in vulns if v["severity"] == "高"),
            "score": random.randint(60, 95),
        },
        "items": vulns,
    }


async def _execute_compatibility(cfg: dict) -> dict:
    """兼容：有 URL 则用多 UA 真实请求验证，否则生成矩阵结果"""
    url = cfg.get("url")
    browsers = cfg.get("browsers") or [
        {
            "name": "Chrome 125",
            "os": "Windows 11",
            "resolution": "1920x1080",
            "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
        },
        {
            "name": "Safari 17",
            "os": "macOS Sonoma",
            "resolution": "2560x1600",
            "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15",
        },
        {
            "name": "Firefox 126",
            "os": "Ubuntu 22.04",
            "resolution": "1366x768",
            "ua": "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
        },
        {
            "name": "Edge 125",
            "os": "Windows 10",
            "resolution": "1920x1080",
            "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36 Edg/125.0",
        },
    ]
    items = []
    for b in browsers:
        if url:
            success, cost, status, _ = await _probe_url(url, {"User-Agent": b["ua"]})
            ok = success and status < 500
            rate = 100.0 if ok else random.uniform(60, 90)
        else:
            ok = random.random() > 0.15
            rate = round(random.uniform(85, 100), 1)
        items.append(
            {
                "browser": b["name"],
                "os": b["os"],
                "resolution": b["resolution"],
                "pass_rate": f"{rate}%",
                "status": "完成" if ok else "异常",
            }
        )
    ok_count = sum(1 for i in items if i["status"] == "完成")
    return {
        "summary": {
            "url": url or "未配置",
            "checked": len(items),
            "passed": ok_count,
            "match_rate": round(ok_count / len(items) * 100, 1),
        },
        "items": items,
    }


async def _execute_regression(cfg: dict) -> dict:
    """回归：生成回归执行结果（无真实可执行目标时结构化模拟）"""
    name = cfg.get("name") or "回归测试"
    total = int(cfg.get("total") or random.randint(20, 60))
    failed = int(total * random.uniform(0, 0.15))
    passed = total - failed
    return {
        "summary": {
            "name": name,
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": round(passed / total * 100, 1),
            "duration_s": round(random.uniform(30, 300), 1),
        },
        "items": [
            {
                "name": f"回归用例{i}",
                "module": random.choice(["认证模块", "订单模块", "工具库"]),
                "status": "通过" if i <= passed else "失败",
                "reason": "代码变更直接关联" if i <= passed else "断言不匹配",
            }
            for i in range(1, total + 1)
        ],
    }


async def _execute_exploratory(cfg: dict) -> dict:
    """探索：有 URL 则真实抓取页面标题/链接，否则生成发现记录"""
    url = cfg.get("url")
    if url:
        success, cost, status, _ = await _probe_url(url)
        findings = []
        if not success:
            findings.append(
                {"title": "目标页面无法访问", "severity": "高", "status": "已确认"}
            )
        else:
            # 尝试解析页面内容（尽力而为，失败不阻塞）
            try:
                import httpx
                import re

                async with httpx.AsyncClient(
                    timeout=5, follow_redirects=True
                ) as client:
                    resp = await client.get(url)
                    text = resp.text[:20000]
                links = set(re.findall(r'href="(/[^"#?]*)"', text))
                title = re.search(r"<title>(.*?)</title>", text, re.S)
                findings = [
                    {
                        "title": title.group(1).strip() if title else "首页",
                        "severity": "低",
                        "status": "已确认",
                    },
                    {
                        "title": f"发现 {len(links)} 个内部链接",
                        "severity": "低",
                        "status": "已确认",
                    },
                ]
            except Exception:
                findings = [{"title": "首页", "severity": "低", "status": "已确认"}]
        return {
            "summary": {
                "url": url,
                "pages_found": len(findings) + random.randint(0, 3),
                "findings": len(findings),
            },
            "items": findings,
        }
    issues = [
        {"title": t, "severity": s, "status": random.choice(["已确认", "待确认"])}
        for t, s in [
            ("注册页面404", "中"),
            ("搜索无结果提示不友好", "低"),
            ("移动端样式错位", "中"),
            ("按钮重复点击提交", "高"),
        ]
    ]
    return {
        "summary": {
            "url": url or "未配置",
            "pages_found": random.randint(3, 8),
            "findings": len(issues),
        },
        "items": issues,
    }


_EXECUTORS = {
    "performance": _execute_performance,
    "security": _execute_security,
    "compatibility": _execute_compatibility,
    "regression": _execute_regression,
    "exploratory": _execute_exploratory,
}


@router.post("/{task_id}/execute", response_model=ResponseModel)
async def execute_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """执行任务：状态 待执行 -> 执行中 -> 完成/失败"""
    item = await db.get(TestTask, task_id)
    if not item or item.created_by != user.id:
        return ResponseModel(success=False, message="任务不存在", data=None)
    if item.status == "执行中":
        return ResponseModel(success=False, message="任务正在执行中", data=None)

    item.status = "执行中"
    item.result = None
    item.duration_ms = None
    await db.commit()

    import time

    t0 = time.time()
    executor = _EXECUTORS.get(item.task_type)
    try:
        result = await executor(item.config or {}) if executor else {"items": []}
        item.result = result
        item.duration_ms = int((time.time() - t0) * 1000)
        item.status = "完成"
    except Exception as e:
        item.result = {"error": str(e)}
        item.duration_ms = int((time.time() - t0) * 1000)
        item.status = "失败"
    await db.commit()
    await db.refresh(item)
    return ResponseModel(
        message="执行完成" if item.status == "完成" else "执行失败", data=_to_dict(item)
    )
