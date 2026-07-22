"""操作日志服务"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.operation_log import OperationLog


async def create_operation_log(
    db: AsyncSession,
    *,
    user_id: int = None,
    username: str = None,
    module: str,
    action: str,
    target_id: str = None,
    target_type: str = None,
    detail: dict = None,
    ip_address: str = None,
):
    """记录操作日志"""
    log = OperationLog(
        user_id=user_id,
        username=username,
        module=module,
        action=action,
        target_id=target_id,
        target_type=target_type,
        detail=detail,
        ip_address=ip_address,
    )
    db.add(log)
    await db.commit()
    return log


async def get_operation_logs(
    db: AsyncSession,
    *,
    user_id: int = None,
    module: str = None,
    page: int = 1,
    page_size: int = 20,
):
    """查询操作日志"""
    query = select(OperationLog)

    if user_id:
        query = query.where(OperationLog.user_id == user_id)
    if module:
        query = query.where(OperationLog.module == module)

    query = query.order_by(OperationLog.created_at.desc())

    # 分页
    total_q = select(func.count(OperationLog.id))
    if module:
        total_q = total_q.where(OperationLog.module == module)
    total_result = await db.execute(total_q)
    total = total_result.scalar() or 0
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }
