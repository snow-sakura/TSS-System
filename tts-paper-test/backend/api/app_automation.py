"""AI App 自动化测试路由

覆盖 App 类型 5 个子页面：设备管理 / 测试用例 / 远程执行 / 截图对比 / 崩溃分析。
无真机环境，执行走模拟状态流（待执行 -> 执行中 -> 完成/失败）。
"""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from models.app_automation import (
    AppDevice,
    AppTestCase,
    AppExecution,
    AppScreenshotDiff,
    AppCrashLog,
)
from schemas.common import ResponseModel
from api.deps import get_current_user_dep

router = APIRouter(prefix="/app-test", tags=["AI App自动化"])


def _to_dict(m):
    """ORM 对象转 dict（去除 SQLAlchemy 内部状态）"""
    return {
        c.name: getattr(m, c.name)
        for c in m.__table__.columns
        if c.name not in ("created_at", "updated_at")
    }


async def _list_model(db, model, user_id, page, page_size, keyword, search_fields):
    """通用列表查询：按创建人过滤 + 可选关键词搜索"""
    q = select(model).where(model.created_by == user_id)
    if keyword and search_fields:
        from sqlalchemy import or_

        conds = [getattr(model, f).ilike(f"%{keyword}%") for f in search_fields]
        q = q.where(conds[0] if len(conds) == 1 else or_(*conds))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    q = q.order_by(model.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().all()
    return {
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "items": [_to_dict(m) for m in rows],
    }


async def _get_owned(db, model, item_id, user_id, name):
    """按归属获取记录，不存在返回 None"""
    return await db.get(model, item_id)


# ════════════ 设备管理 ════════════


@router.get("/devices", response_model=ResponseModel)
async def list_devices(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """设备列表"""
    return ResponseModel(
        data=await _list_model(
            db, AppDevice, user.id, page, page_size, keyword, ("name", "os")
        )
    )


@router.post("/devices", response_model=ResponseModel)
async def create_device(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """新建设备"""
    item = AppDevice(
        name=body.get("name") or "新设备",
        os=body.get("os") or "Android",
        version=body.get("version"),
        status=body.get("status") or "空闲",
        created_by=user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="设备已创建", data=_to_dict(item))


@router.put("/devices/{item_id}", response_model=ResponseModel)
async def update_device(
    item_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新设备"""
    item = await _get_owned(db, AppDevice, item_id, user.id, "设备")
    if not item:
        return ResponseModel(success=False, message="设备不存在", data=None)
    for f in ("name", "os", "version", "status"):
        if body.get(f) is not None:
            setattr(item, f, body[f])
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="设备已更新", data=_to_dict(item))


@router.delete("/devices/{item_id}", response_model=ResponseModel)
async def delete_device(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除设备"""
    item = await _get_owned(db, AppDevice, item_id, user.id, "设备")
    if not item:
        return ResponseModel(success=False, message="设备不存在", data=None)
    await db.delete(item)
    await db.commit()
    return ResponseModel(message="设备已删除")


# ════════════ 测试用例 ════════════


@router.get("/test-cases", response_model=ResponseModel)
async def list_test_cases(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """App 测试用例列表"""
    return ResponseModel(
        data=await _list_model(
            db, AppTestCase, user.id, page, page_size, keyword, ("name",)
        )
    )


@router.post("/test-cases", response_model=ResponseModel)
async def create_test_case(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """新建测试用例"""
    item = AppTestCase(
        name=body.get("name") or "新用例",
        platform=body.get("platform") or "Android",
        priority=body.get("priority") or "P1",
        status=body.get("status") or "待执行",
        source=body.get("source") or "手动",
        created_by=user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="用例已创建", data=_to_dict(item))


@router.put("/test-cases/{item_id}", response_model=ResponseModel)
async def update_test_case(
    item_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新测试用例"""
    item = await _get_owned(db, AppTestCase, item_id, user.id, "用例")
    if not item:
        return ResponseModel(success=False, message="用例不存在", data=None)
    for f in ("name", "platform", "priority", "status", "source"):
        if body.get(f) is not None:
            setattr(item, f, body[f])
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="用例已更新", data=_to_dict(item))


@router.delete("/test-cases/{item_id}", response_model=ResponseModel)
async def delete_test_case(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除测试用例"""
    item = await _get_owned(db, AppTestCase, item_id, user.id, "用例")
    if not item:
        return ResponseModel(success=False, message="用例不存在", data=None)
    await db.delete(item)
    await db.commit()
    return ResponseModel(message="用例已删除")


# ════════════ 远程执行 ════════════


@router.get("/executions", response_model=ResponseModel)
async def list_executions(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """执行记录列表"""
    return ResponseModel(
        data=await _list_model(
            db, AppExecution, user.id, page, page_size, keyword, ("name", "device")
        )
    )


@router.post("/executions", response_model=ResponseModel)
async def create_execution(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """创建执行记录"""
    item = AppExecution(
        name=body.get("name") or "App执行",
        device=body.get("device"),
        cases_count=body.get("cases_count") or 0,
        status=body.get("status") or "待执行",
        created_by=user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="执行记录已创建", data=_to_dict(item))


@router.put("/executions/{item_id}", response_model=ResponseModel)
async def update_execution(
    item_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新执行记录"""
    item = await _get_owned(db, AppExecution, item_id, user.id, "执行")
    if not item:
        return ResponseModel(success=False, message="执行记录不存在", data=None)
    for f in ("name", "device", "cases_count", "status"):
        if body.get(f) is not None:
            setattr(item, f, body[f])
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="执行记录已更新", data=_to_dict(item))


@router.post("/executions/{item_id}/run", response_model=ResponseModel)
async def run_execution(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """执行测试（模拟状态流转：执行中 -> 完成）"""
    item = await _get_owned(db, AppExecution, item_id, user.id, "执行")
    if not item:
        return ResponseModel(success=False, message="执行记录不存在", data=None)
    item.status = "执行中"
    await db.commit()

    import asyncio
    import random

    await asyncio.sleep(0.8)
    total = item.cases_count or random.randint(3, 12)
    passed = max(0, int(total * random.uniform(0.7, 1.0)))
    failed = total - passed
    item.passed = passed
    item.failed = failed
    item.pass_rate = round(passed / total * 100, 1) if total else 0.0
    item.duration_ms = random.randint(3000, 60000)
    item.status = "完成" if failed == 0 or random.random() > 0.2 else "失败"
    item.result = {
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": item.pass_rate,
            "device": item.device,
        },
        "steps": [
            {"name": f"用例{i}", "status": "通过" if i <= passed else "失败"}
            for i in range(1, total + 1)
        ],
    }
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="执行完成", data=_to_dict(item))


@router.delete("/executions/{item_id}", response_model=ResponseModel)
async def delete_execution(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除执行记录"""
    item = await _get_owned(db, AppExecution, item_id, user.id, "执行")
    if not item:
        return ResponseModel(success=False, message="执行记录不存在", data=None)
    await db.delete(item)
    await db.commit()
    return ResponseModel(message="执行记录已删除")


# ════════════ 截图对比 ════════════


@router.get("/screenshot-diffs", response_model=ResponseModel)
async def list_screenshot_diffs(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """截图对比列表"""
    return ResponseModel(
        data=await _list_model(
            db, AppScreenshotDiff, user.id, page, page_size, keyword, ("page",)
        )
    )


@router.post("/screenshot-diffs", response_model=ResponseModel)
async def create_screenshot_diff(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """新建截图对比记录"""
    item = AppScreenshotDiff(
        page=body.get("page") or "未命名页面",
        device=body.get("device"),
        result=body.get("result") or "一致",
        similarity=body.get("similarity") or 100.0,
        created_by=user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="记录已创建", data=_to_dict(item))


@router.put("/screenshot-diffs/{item_id}", response_model=ResponseModel)
async def update_screenshot_diff(
    item_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新截图对比记录"""
    item = await _get_owned(db, AppScreenshotDiff, item_id, user.id, "记录")
    if not item:
        return ResponseModel(success=False, message="记录不存在", data=None)
    for f in ("page", "device", "result", "similarity"):
        if body.get(f) is not None:
            setattr(item, f, body[f])
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="记录已更新", data=_to_dict(item))


@router.delete("/screenshot-diffs/{item_id}", response_model=ResponseModel)
async def delete_screenshot_diff(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除截图对比记录"""
    item = await _get_owned(db, AppScreenshotDiff, item_id, user.id, "记录")
    if not item:
        return ResponseModel(success=False, message="记录不存在", data=None)
    await db.delete(item)
    await db.commit()
    return ResponseModel(message="记录已删除")


# ════════════ 崩溃分析 ════════════


@router.get("/crash-logs", response_model=ResponseModel)
async def list_crash_logs(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """崩溃日志列表"""
    return ResponseModel(
        data=await _list_model(
            db, AppCrashLog, user.id, page, page_size, keyword, ("crash_type", "device")
        )
    )


@router.post("/crash-logs", response_model=ResponseModel)
async def create_crash_log(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """新建崩溃日志"""
    item = AppCrashLog(
        crash_type=body.get("crash_type") or "未知异常",
        device=body.get("device"),
        count=body.get("count") or 1,
        status=body.get("status") or "待分析",
        detail=body.get("detail"),
        created_by=user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="日志已创建", data=_to_dict(item))


@router.put("/crash-logs/{item_id}", response_model=ResponseModel)
async def update_crash_log(
    item_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """更新崩溃日志"""
    item = await _get_owned(db, AppCrashLog, item_id, user.id, "日志")
    if not item:
        return ResponseModel(success=False, message="日志不存在", data=None)
    for f in ("crash_type", "device", "count", "status", "detail"):
        if body.get(f) is not None:
            setattr(item, f, body[f])
    await db.commit()
    await db.refresh(item)
    return ResponseModel(message="日志已更新", data=_to_dict(item))


@router.delete("/crash-logs/{item_id}", response_model=ResponseModel)
async def delete_crash_log(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_dep),
):
    """删除崩溃日志"""
    item = await _get_owned(db, AppCrashLog, item_id, user.id, "日志")
    if not item:
        return ResponseModel(success=False, message="日志不存在", data=None)
    await db.delete(item)
    await db.commit()
    return ResponseModel(message="日志已删除")
