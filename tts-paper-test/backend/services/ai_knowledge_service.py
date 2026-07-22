"""
AI 知识增强服务 — LLM 驱动的自动提取、智能搜索、模式发现

功能:
  - 从工作流执行结果自动提取测试模式
  - 从执行失败自动提取 Bug 知识
  - LLM 增强的 RAG 搜索（查询改写 + 语义重排 + 上下文回答）
  - 从文本自动生成模式建议
"""

import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from models.knowledge import TestPattern, BugKnowledge, KnowledgeSearchLog
from models.workflow import WorkflowExecution, WorkflowNodeExecution

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """你是一位经验丰富的软件测试专家。你的任务是从测试执行数据中提取有价值的测试模式或 Bug 知识。

请根据以下执行数据，分析并提取结构化信息。如果数据包含多个可提取的信息，选择最主要的一个。

输出 JSON 格式（不要包含 markdown 代码块标记）：
{
  "type": "test_pattern" 或 "bug_knowledge",
  "title": "标题",
  "category": "功能测试/性能测试/安全测试/兼容性测试/自动化测试" (仅 test_pattern),
  "description": "详细描述",
  "steps": "执行步骤" (仅 test_pattern),
  "expected_result": "预期结果" (仅 test_pattern),
  "severity": "P0/P1/P2/P3" (仅 bug_knowledge),
  "root_cause": "根因分析" (仅 bug_knowledge),
  "solution": "解决方案" (仅 bug_knowledge),
  "tags": "标签1,标签2,标签3",
  "confidence": 0-100 的置信度分数
}

如果数据没有足够信息提取，返回 {"type": "none", "reason": "原因"}。"""

SEARCH_SYSTEM_PROMPT = """你是一个测试知识库的 AI 助手。你需要：
1. 理解用户的搜索意图
2. 从搜索结果中找出最相关的信息
3. 基于搜索结果给出有洞察的回答

请以 JSON 格式输出：
{
  "rewritten_query": "优化后的搜索查询",
  "answer": "基于搜索结果的回答（Markdown 格式）",
  "key_insights": ["洞察1", "洞察2"],
  "related_topics": ["相关主题1", "相关主题2"]
}"""


async def _call_llm(system_prompt: str, user_prompt: str, model: str = "gpt-4o") -> Optional[str]:
    """调用 LLM（复用项目的 OpenAI 配置）"""
    try:
        from openai import AsyncOpenAI
        from config import get_settings

        settings = get_settings()
        client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY or "sk-placeholder",
            base_url=settings.OPENAI_BASE_URL,
        )
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=2000,
        )
        return resp.choices[0].message.content
    except Exception as e:
        logger.warning(f"LLM 调用失败: {e}")
        return None


async def _parse_llm_json(text: Optional[str]) -> dict:
    """从 LLM 回复中安全解析 JSON"""
    if not text:
        return {"type": "none", "reason": "LLM 无响应"}
    try:
        # 尝试提取 JSON 块
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except json.JSONDecodeError:
        logger.warning(f"LLM JSON 解析失败: {text[:200]}")
        return {"type": "none", "reason": "解析失败"}


# ──────────────────────────────────────────
# 从执行记录自动提取测试模式
# ──────────────────────────────────────────

async def auto_extract_patterns_from_execution(
    db: AsyncSession,
    execution_id: int,
) -> dict:
    """分析工作流执行记录，自动提取测试模式"""
    result = await db.execute(
        select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        return {"success": False, "error": "执行记录不存在"}

    node_execs = execution.node_executions or []

    # 构建 LLM 输入
    exec_summary = {
        "execution_id": execution.id,
        "workflow_id": execution.workflow_id,
        "status": execution.status,
        "error": execution.error,
        "started_at": str(execution.started_at) if execution.started_at else None,
        "finished_at": str(execution.finished_at) if execution.finished_at else None,
        "nodes": [
            {
                "type": ne.node_type,
                "label": ne.node_label,
                "status": ne.status,
                "error": ne.error,
                "input": ne.input_data,
                "output": ne.output_data,
            }
            for ne in node_execs
        ],
    }

    llm_result = await _call_llm(
        EXTRACTION_SYSTEM_PROMPT,
        json.dumps(exec_summary, ensure_ascii=False, indent=2),
    )

    parsed = await _parse_llm_json(llm_result)
    extracted = {"success": True, "extracted_type": parsed.get("type")}

    if parsed.get("type") == "none":
        extracted["reason"] = parsed.get("reason", "无足够信息")
        return extracted

    if parsed["type"] == "test_pattern":
        pattern = TestPattern(
            name=parsed.get("title", f"从执行 #{execution_id} 提取"),
            category=parsed.get("category", "自动化测试"),
            description=parsed.get("description", ""),
            steps=parsed.get("steps", ""),
            expected_result=parsed.get("expected_result", ""),
            tags=parsed.get("tags", ""),
            ai_score=parsed.get("confidence", 50),
            status="启用",
        )
        db.add(pattern)
        await db.flush()
        extracted["pattern_id"] = pattern.id
        extracted["title"] = pattern.name

    elif parsed["type"] == "bug_knowledge":
        bug = BugKnowledge(
            title=parsed.get("title", f"从执行 #{execution_id} 发现"),
            severity=parsed.get("severity", "P3"),
            root_cause=parsed.get("root_cause", ""),
            solution=parsed.get("solution", ""),
            symptoms=parsed.get("description", ""),
            tags=parsed.get("tags", ""),
            status="待解决",
        )
        db.add(bug)
        await db.flush()
        extracted["bug_id"] = bug.id
        extracted["title"] = bug.title

    await db.commit()
    return extracted


# ──────────────────────────────────────────
# LLM 增强的 RAG 搜索
# ──────────────────────────────────────────

async def ai_search(
    db: AsyncSession,
    query: str,
    search_type: str = "all",
    limit: int = 10,
) -> dict:
    """AI 增强搜索：查询改写 + 语义重排 + 回答生成"""
    # Step 1: 基础关键词搜索
    base_results = await _keyword_search(db, query, search_type, limit * 2)

    # Step 2: LLM 增强
    search_context = "\n\n".join([
        f"[{r['type']}] {r['title']}\n{r['content'][:500]}"
        for r in base_results
    ])

    enhanced = {"answer": "", "key_insights": [], "related_topics": []}

    if search_context:
        # 有搜索结果时，让LLM基于结果生成回答
        llm_result = await _call_llm(
            SEARCH_SYSTEM_PROMPT,
            f"用户查询: {query}\n\n搜索结果:\n{search_context}",
        )
        enhanced = await _parse_llm_json(llm_result)
    else:
        # 无搜索结果时，让LLM直接回答
        FALLBACK_PROMPT = """你是一个测试知识库的AI助手。用户询问了一个问题但知识库中没有找到直接相关的知识。
请基于你的专业知识直接回答用户的问题，并给出实用的建议。"""
        llm_result = await _call_llm(
            FALLBACK_PROMPT,
            f"用户查询: {query}",
        )
        if llm_result:
            enhanced["answer"] = llm_result
        else:
            enhanced["answer"] = f"抱歉，知识库中暂时没有与「{query}」直接相关的内容。建议：\n1. 尝试使用不同的关键词搜索\n2. 在测试模式库或Bug知识库中手动添加相关知识\n3. 联系管理员扩充知识库"

    # Step 3: 整合结果
    final_results = base_results[:limit]

    # 记录搜索日志
    log = KnowledgeSearchLog(
        query=query,
        result_type=f"ai_{search_type}",
        result_count=len(final_results),
    )
    db.add(log)
    await db.commit()

    return {
        "query": query,
        "rewritten_query": enhanced.get("rewritten_query", query),
        "answer": enhanced.get("answer", ""),
        "key_insights": enhanced.get("key_insights", []),
        "related_topics": enhanced.get("related_topics", []),
        "results": final_results,
        "total": len(final_results),
    }


async def _keyword_search(
    db: AsyncSession,
    query: str,
    search_type: str = "all",
    limit: int = 10,
) -> list[dict]:
    """关键词搜索（复用现有逻辑）"""
    results = []

    if search_type in ("all", "test_pattern"):
        pq = select(TestPattern).where(or_(
            TestPattern.name.contains(query),
            TestPattern.description.contains(query),
            TestPattern.steps.contains(query),
            TestPattern.tags.contains(query),
        )).limit(limit)
        for p in (await db.execute(pq)).scalars().all():
            results.append({
                "id": p.id,
                "type": "test_pattern",
                "title": p.name,
                "content": p.description or p.steps or "",
                "relevance_score": 0.9 if query.lower() in (p.name or "").lower() else 0.6,
                "metadata": {"category": p.category, "ai_score": p.ai_score, "usage_count": p.usage_count},
            })

    if search_type in ("all", "bug_knowledge"):
        bq = select(BugKnowledge).where(or_(
            BugKnowledge.title.contains(query),
            BugKnowledge.root_cause.contains(query),
            BugKnowledge.solution.contains(query),
            BugKnowledge.symptoms.contains(query),
            BugKnowledge.tags.contains(query),
        )).limit(limit)
        for b in (await db.execute(bq)).scalars().all():
            results.append({
                "id": b.id,
                "type": "bug_knowledge",
                "title": b.title,
                "content": b.root_cause or b.solution or b.symptoms or "",
                "relevance_score": 0.9 if query.lower() in (b.title or "").lower() else 0.6,
                "metadata": {"severity": b.severity, "module": b.module, "occurrence_count": b.occurrence_count},
            })

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results[:limit]


# ──────────────────────────────────────────
# 从文本建议模式
# ──────────────────────────────────────────

async def suggest_patterns_from_text(
    db: AsyncSession,
    text: str,
    context: Optional[str] = None,
) -> dict:
    """从自由文本提取测试模式建议"""
    full_text = text
    if context:
        full_text = f"上下文: {context}\n\n内容: {text}"

    llm_result = await _call_llm(
        EXTRACTION_SYSTEM_PROMPT,
        full_text,
    )

    parsed = await _parse_llm_json(llm_result)

    if parsed.get("type") == "none":
        return {"success": True, "extracted": False, "reason": parsed.get("reason", "无足够信息")}

    if parsed["type"] == "test_pattern":
        return {
            "success": True,
            "extracted": True,
            "type": "test_pattern",
            "suggestion": {
                "name": parsed.get("title", ""),
                "category": parsed.get("category", "自动化测试"),
                "description": parsed.get("description", ""),
                "steps": parsed.get("steps", ""),
                "expected_result": parsed.get("expected_result", ""),
                "tags": parsed.get("tags", ""),
                "confidence": parsed.get("confidence", 50),
            },
        }

    return {
        "success": True,
        "extracted": True,
        "type": "bug_knowledge",
        "suggestion": {
            "title": parsed.get("title", ""),
            "severity": parsed.get("severity", "P3"),
            "root_cause": parsed.get("root_cause", ""),
            "solution": parsed.get("solution", ""),
            "tags": parsed.get("tags", ""),
            "confidence": parsed.get("confidence", 50),
        },
    }


# ──────────────────────────────────────────
# 从执行失败自动创建 Bug 知识
# ──────────────────────────────────────────

async def auto_create_bug_from_failure(
    db: AsyncSession,
    execution_id: int,
    node_execution_id: int,
) -> dict:
    """从失败的节点执行自动创建 Bug 知识"""
    result = await db.execute(
        select(WorkflowNodeExecution).where(WorkflowNodeExecution.id == node_execution_id)
    )
    ne = result.scalar_one_or_none()
    if not ne:
        return {"success": False, "error": "节点执行记录不存在"}

    # 检查是否已存在类似 Bug
    if ne.error:
        existing = await db.execute(
            select(BugKnowledge).where(
                BugKnowledge.symptoms.contains(ne.error[:100])
            ).limit(1)
        )
        if existing.scalar_one_or_none():
            return {"success": False, "reason": "相似 Bug 已存在"}

    payload = {
        "node_type": ne.node_type,
        "node_label": ne.node_label,
        "status": ne.status,
        "error": ne.error,
        "input_data": ne.input_data,
        "output_data": ne.output_data,
    }

    prompt = f"""从以下失败的测试节点执行中提取 Bug 知识。
执行数据：{json.dumps(payload, ensure_ascii=False, indent=2)}

请分析失败原因并输出 Bug 知识 JSON：
{{
  "title": "Bug 标题",
  "severity": "P0/P1/P2/P3",
  "root_cause": "根因分析",
  "solution": "建议修复方案",
  "symptoms": "症状描述",
  "tags": "标签"
}}"""

    llm_result = await _call_llm(
        "你是一个 Bug 分析专家。请分析测试执行失败数据并提取结构化的 Bug 知识。",
        prompt,
    )

    parsed = await _parse_llm_json(llm_result)

    bug = BugKnowledge(
        title=parsed.get("title", f"从执行 #{execution_id} 节点 #{node_execution_id} 发现"),
        severity=parsed.get("severity", "P3"),
        root_cause=parsed.get("root_cause", ne.error or ""),
        solution=parsed.get("solution", ""),
        symptoms=parsed.get("symptoms", ne.error or ""),
        tags=parsed.get("tags", ""),
        status="待解决",
    )
    db.add(bug)
    await db.commit()
    await db.refresh(bug)

    return {"success": True, "bug_id": bug.id, "title": bug.title}
