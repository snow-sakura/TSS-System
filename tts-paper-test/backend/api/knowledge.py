"""知识库 - API路由"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.common import ResponseModel
from schemas.knowledge import (
    TestPatternCreate, TestPatternUpdate, TestPatternResponse,
    BugKnowledgeCreate, BugKnowledgeUpdate, BugKnowledgeResponse,
    KnowledgeSearchRequest, KnowledgeSearchResponse, KnowledgeSearchResult,
)
from schemas.knowledge_ai import (
    AIExtractRequest, AIExtractResponse,
    AISearchRequest, AISearchResponse, AISearchResponseItem,
    SuggestPatternRequest, SuggestPatternResponse,
    AutoCreateBugRequest, AutoCreateBugResponse,
)
from services import knowledge_service as svc
from services.ai_knowledge_service import (
    auto_extract_patterns_from_execution,
    ai_search,
    suggest_patterns_from_text,
    auto_create_bug_from_failure,
)

router = APIRouter(prefix="/api/v1/knowledge", tags=["知识库"])


def _page(model, items):
    return [model.model_validate(i) for i in items]


# ============================
# 测试模式库 CRUD
# ============================

@router.get("/test-patterns", response_model=ResponseModel)
async def list_test_patterns(page: int = 1, page_size: int = 20, search: str = None,
                             category: str = None, status: str = None, db: AsyncSession = Depends(get_db)):
    result = await svc.list_test_patterns(db, page, page_size, search, category, status)
    result["items"] = _page(TestPatternResponse, result["items"])
    return ResponseModel(data=result)


@router.get("/test-patterns/{pattern_id}", response_model=ResponseModel)
async def get_test_pattern(pattern_id: int, db: AsyncSession = Depends(get_db)):
    pattern = await svc.get_test_pattern(db, pattern_id)
    if not pattern:
        return ResponseModel(success=False, message="模式不存在")
    return ResponseModel(data=TestPatternResponse.model_validate(pattern))


@router.post("/test-patterns", response_model=ResponseModel)
async def create_test_pattern(data: TestPatternCreate, db: AsyncSession = Depends(get_db)):
    pattern = await svc.create_test_pattern(db, data)
    return ResponseModel(message="模式创建成功", data=TestPatternResponse.model_validate(pattern))


@router.put("/test-patterns/{pattern_id}", response_model=ResponseModel)
async def update_test_pattern(pattern_id: int, data: TestPatternUpdate, db: AsyncSession = Depends(get_db)):
    pattern = await svc.update_test_pattern(db, pattern_id, data)
    if not pattern:
        return ResponseModel(success=False, message="模式不存在")
    return ResponseModel(message="模式更新成功", data=TestPatternResponse.model_validate(pattern))


@router.delete("/test-patterns/{pattern_id}", response_model=ResponseModel)
async def delete_test_pattern(pattern_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_test_pattern(db, pattern_id)
    if not ok:
        return ResponseModel(success=False, message="模式不存在")
    return ResponseModel(message="模式已删除")


@router.post("/test-patterns/batch-delete", response_model=ResponseModel)
async def batch_delete_test_patterns(ids: list[int], db: AsyncSession = Depends(get_db)):
    await svc.batch_delete_test_patterns(db, ids)
    return ResponseModel(message=f"已删除 {len(ids)} 条模式")


# ============================
# Bug知识库 CRUD
# ============================

@router.get("/bug-knowledge", response_model=ResponseModel)
async def list_bug_knowledge(page: int = 1, page_size: int = 20, search: str = None,
                             severity: str = None, status: str = None, db: AsyncSession = Depends(get_db)):
    result = await svc.list_bug_knowledge(db, page, page_size, search, severity, status)
    result["items"] = _page(BugKnowledgeResponse, result["items"])
    return ResponseModel(data=result)


@router.get("/bug-knowledge/{bug_id}", response_model=ResponseModel)
async def get_bug_knowledge(bug_id: int, db: AsyncSession = Depends(get_db)):
    bug = await svc.get_bug_knowledge(db, bug_id)
    if not bug:
        return ResponseModel(success=False, message="Bug不存在")
    return ResponseModel(data=BugKnowledgeResponse.model_validate(bug))


@router.post("/bug-knowledge", response_model=ResponseModel)
async def create_bug_knowledge(data: BugKnowledgeCreate, db: AsyncSession = Depends(get_db)):
    bug = await svc.create_bug_knowledge(db, data)
    return ResponseModel(message="Bug创建成功", data=BugKnowledgeResponse.model_validate(bug))


@router.put("/bug-knowledge/{bug_id}", response_model=ResponseModel)
async def update_bug_knowledge(bug_id: int, data: BugKnowledgeUpdate, db: AsyncSession = Depends(get_db)):
    bug = await svc.update_bug_knowledge(db, bug_id, data)
    if not bug:
        return ResponseModel(success=False, message="Bug不存在")
    return ResponseModel(message="Bug更新成功", data=BugKnowledgeResponse.model_validate(bug))


@router.delete("/bug-knowledge/{bug_id}", response_model=ResponseModel)
async def delete_bug_knowledge(bug_id: int, db: AsyncSession = Depends(get_db)):
    ok = await svc.delete_bug_knowledge(db, bug_id)
    if not ok:
        return ResponseModel(success=False, message="Bug不存在")
    return ResponseModel(message="Bug已删除")


@router.post("/bug-knowledge/batch-delete", response_model=ResponseModel)
async def batch_delete_bug_knowledge(ids: list[int], db: AsyncSession = Depends(get_db)):
    await svc.batch_delete_bug_knowledge(db, ids)
    return ResponseModel(message=f"已删除 {len(ids)} 条Bug")


# ============================
# RAG搜索
# ============================

@router.post("/search", response_model=ResponseModel)
async def search_knowledge(data: KnowledgeSearchRequest, db: AsyncSession = Depends(get_db)):
    import time
    start = time.time()
    results = await svc.search_knowledge(db, data.query, data.search_type, data.limit)
    response_time_ms = int((time.time() - start) * 1000)

    search_results = [KnowledgeSearchResult(**r) for r in results]
    response = KnowledgeSearchResponse(
        query=data.query,
        results=search_results,
        total=len(search_results),
        response_time_ms=response_time_ms
    )
    return ResponseModel(data=response)


# ============================
# AI 增强功能
# ============================

@router.post("/ai/extract-from-execution", response_model=ResponseModel)
async def api_auto_extract(data: AIExtractRequest, db: AsyncSession = Depends(get_db)):
    """从工作流执行记录自动提取测试模式或 Bug 知识"""
    result = await auto_extract_patterns_from_execution(db, data.execution_id)
    return ResponseModel(
        success=result.get("success", False),
        message="提取完成" if result.get("success") else result.get("error", "提取失败"),
        data=result
    )


@router.post("/ai/search", response_model=ResponseModel)
async def api_ai_search(data: AISearchRequest, db: AsyncSession = Depends(get_db)):
    """AI 增强搜索：查询改写 + 语义重排 + 上下文回答"""
    result = await ai_search(db, data.query, data.search_type or "all", data.limit or 10)
    response = AISearchResponse(
        query=result["query"],
        rewritten_query=result.get("rewritten_query"),
        answer=result.get("answer"),
        key_insights=result.get("key_insights", []),
        related_topics=result.get("related_topics", []),
        results=[AISearchResponseItem(**r) for r in result.get("results", [])],
        total=result.get("total", 0),
    )
    return ResponseModel(data=response)


@router.post("/ai/suggest-patterns", response_model=ResponseModel)
async def api_suggest_patterns(data: SuggestPatternRequest, db: AsyncSession = Depends(get_db)):
    """从自由文本生成测试模式或 Bug 知识建议"""
    result = await suggest_patterns_from_text(db, data.text, data.context)
    return ResponseModel(data=result)


@router.post("/ai/create-bug-from-failure", response_model=ResponseModel)
async def api_auto_create_bug(data: AutoCreateBugRequest, db: AsyncSession = Depends(get_db)):
    """从失败的节点执行自动创建 Bug 知识"""
    result = await auto_create_bug_from_failure(db, data.execution_id, data.node_execution_id)
    return ResponseModel(
        success=result.get("success", False),
        message=result.get("title", result.get("reason", "")),
        data=result,
    )
