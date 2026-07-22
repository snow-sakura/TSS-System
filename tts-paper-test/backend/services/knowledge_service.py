"""知识库 - 业务逻辑"""

from datetime import datetime
from typing import Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from models.knowledge import TestPattern, BugKnowledge, KnowledgeSearchLog
from schemas.knowledge import (
    TestPatternCreate, TestPatternUpdate,
    BugKnowledgeCreate, BugKnowledgeUpdate,
)


# ============================
# 测试模式库 CRUD
# ============================

async def list_test_patterns(db: AsyncSession, page: int = 1, page_size: int = 20,
                             search: str = None, category: str = None, status: str = None):
    query = select(TestPattern)
    count_query = select(func.count(TestPattern.id))

    if search:
        query = query.where(or_(
            TestPattern.name.contains(search),
            TestPattern.description.contains(search),
            TestPattern.tags.contains(search)
        ))
        count_query = count_query.where(or_(
            TestPattern.name.contains(search),
            TestPattern.description.contains(search),
            TestPattern.tags.contains(search)
        ))
    if category:
        query = query.where(TestPattern.category == category)
        count_query = count_query.where(TestPattern.category == category)
    if status:
        query = query.where(TestPattern.status == status)
        count_query = count_query.where(TestPattern.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(TestPattern.id.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}


async def get_test_pattern(db: AsyncSession, pattern_id: int):
    return (await db.execute(select(TestPattern).where(TestPattern.id == pattern_id))).scalar_one_or_none()


async def create_test_pattern(db: AsyncSession, data: TestPatternCreate):
    pattern = TestPattern(**data.model_dump())
    db.add(pattern)
    await db.commit()
    await db.refresh(pattern)
    return pattern


async def update_test_pattern(db: AsyncSession, pattern_id: int, data: TestPatternUpdate):
    pattern = await get_test_pattern(db, pattern_id)
    if not pattern:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pattern, key, value)
    pattern.updated_at = datetime.now()
    await db.commit()
    await db.refresh(pattern)
    return pattern


async def delete_test_pattern(db: AsyncSession, pattern_id: int):
    pattern = await get_test_pattern(db, pattern_id)
    if not pattern:
        return False
    await db.delete(pattern)
    await db.commit()
    return True


async def batch_delete_test_patterns(db: AsyncSession, ids: list[int]):
    for pattern_id in ids:
        pattern = await get_test_pattern(db, pattern_id)
        if pattern:
            await db.delete(pattern)
    await db.commit()
    return True


# ============================
# Bug知识库 CRUD
# ============================

async def list_bug_knowledge(db: AsyncSession, page: int = 1, page_size: int = 20,
                             search: str = None, severity: str = None, status: str = None):
    query = select(BugKnowledge)
    count_query = select(func.count(BugKnowledge.id))

    if search:
        query = query.where(or_(
            BugKnowledge.title.contains(search),
            BugKnowledge.root_cause.contains(search),
            BugKnowledge.solution.contains(search),
            BugKnowledge.tags.contains(search)
        ))
        count_query = count_query.where(or_(
            BugKnowledge.title.contains(search),
            BugKnowledge.root_cause.contains(search),
            BugKnowledge.solution.contains(search),
            BugKnowledge.tags.contains(search)
        ))
    if severity:
        query = query.where(BugKnowledge.severity == severity)
        count_query = count_query.where(BugKnowledge.severity == severity)
    if status:
        query = query.where(BugKnowledge.status == status)
        count_query = count_query.where(BugKnowledge.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(BugKnowledge.id.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size}


async def get_bug_knowledge(db: AsyncSession, bug_id: int):
    return (await db.execute(select(BugKnowledge).where(BugKnowledge.id == bug_id))).scalar_one_or_none()


async def create_bug_knowledge(db: AsyncSession, data: BugKnowledgeCreate):
    bug = BugKnowledge(**data.model_dump())
    db.add(bug)
    await db.commit()
    await db.refresh(bug)
    return bug


async def update_bug_knowledge(db: AsyncSession, bug_id: int, data: BugKnowledgeUpdate):
    bug = await get_bug_knowledge(db, bug_id)
    if not bug:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(bug, key, value)
    bug.updated_at = datetime.now()
    await db.commit()
    await db.refresh(bug)
    return bug


async def delete_bug_knowledge(db: AsyncSession, bug_id: int):
    bug = await get_bug_knowledge(db, bug_id)
    if not bug:
        return False
    await db.delete(bug)
    await db.commit()
    return True


async def batch_delete_bug_knowledge(db: AsyncSession, ids: list[int]):
    for bug_id in ids:
        bug = await get_bug_knowledge(db, bug_id)
        if bug:
            await db.delete(bug)
    await db.commit()
    return True


# ============================
# RAG搜索（简单关键词匹配）
# ============================

async def search_knowledge(db: AsyncSession, query: str, search_type: str = "all", limit: int = 10):
    results = []

    # 搜索测试模式库
    if search_type in ("all", "test_pattern"):
        pattern_query = select(TestPattern).where(or_(
            TestPattern.name.contains(query),
            TestPattern.description.contains(query),
            TestPattern.steps.contains(query),
            TestPattern.tags.contains(query)
        )).limit(limit)
        patterns = (await db.execute(pattern_query)).scalars().all()
        for p in patterns:
            results.append({
                "id": p.id,
                "type": "test_pattern",
                "title": p.name,
                "content": p.description or p.steps or "",
                "relevance_score": 0.8 if query.lower() in (p.name or "").lower() else 0.5,
                "metadata": {"category": p.category, "ai_score": p.ai_score}
            })

    # 搜索Bug知识库
    if search_type in ("all", "bug_knowledge"):
        bug_query = select(BugKnowledge).where(or_(
            BugKnowledge.title.contains(query),
            BugKnowledge.root_cause.contains(query),
            BugKnowledge.solution.contains(query),
            BugKnowledge.symptoms.contains(query),
            BugKnowledge.tags.contains(query)
        )).limit(limit)
        bugs = (await db.execute(bug_query)).scalars().all()
        for b in bugs:
            results.append({
                "id": b.id,
                "type": "bug_knowledge",
                "title": b.title,
                "content": b.root_cause or b.solution or b.symptoms or "",
                "relevance_score": 0.8 if query.lower() in (b.title or "").lower() else 0.5,
                "metadata": {"severity": b.severity, "module": b.module}
            })

    # 按相关度排序
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    results = results[:limit]

    # 记录搜索日志
    log = KnowledgeSearchLog(
        query=query,
        result_type=search_type,
        result_count=len(results)
    )
    db.add(log)
    await db.commit()

    return results
