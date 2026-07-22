"""
全流程 Pipeline 编排服务 — DB 版

按序执行: 需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审
上一个阶段的输出作为下一个阶段的上下文输入
以 SSE 事件流推送每个阶段的进度、日志和流式内容

日志说明：
  - 所有阶段输出、SSE事件、Agent调用均实时打印到IDE终端
  - 格式: [时间] [级别] [阶段标签] 消息内容
  - SSE流式内容以 [SSE→event_type] 前缀标记
"""
import json
import time
import uuid
from typing import AsyncGenerator, Optional
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging_config import get_logger
from models.test_lifecycle import Requirement, PipelineRecord

logger = get_logger("pipeline_service")

# 5个阶段的定义
STAGES = [
    {"key": "requirements", "label": "需求分析",
     "icon": "FileText", "gradient": "from-blue-500 to-indigo-600",
     "system_prompt": """你是一位资深的软件需求分析专家。你的任务是对用户提供的需求内容进行全面、深入的分析。

请严格按照以下Markdown格式输出分析报告（这是固定的输出格式，必须遵守）：

---

## 📋 需求概述

[用2-3句话概括需求的整体范围和目标]

---

## 🎯 功能点分析

| 功能点 | 描述 | 优先级 | 分类 |
|--------|------|--------|------|
| [功能点名称] | [简要描述] | P0/P1/P2 | [核心功能/辅助功能/优化功能] |

---

## 📝 业务规则

1. **[规则名称]**: [规则详细说明]
2. **[规则名称]**: [规则详细说明]

---

## ⚠️ 潜在风险与约束

| 风险/约束 | 类型 | 影响 | 建议 |
|-----------|------|------|------|
| [风险描述] | 技术/业务/安全 | [影响范围] | [缓解建议] |

---

## 💡 优化建议

1. **[建议标题]**: [详细建议说明]

---

## 🏷️ 需求标签

`标签1` `标签2` `标签3`

---

## 📊 分析总结

[对需求的整体评估，包括复杂度、完整性、可测试性等方面的评价]
"""},
    {"key": "test-plans", "label": "规划方案",
     "icon": "ClipboardList", "gradient": "from-cyan-500 to-teal-600",
     "system_prompt": """你是一位资深的测试策略专家。根据需求分析结果，制定完整的测试方案。

请严格按照以下Markdown格式输出测试方案：

---

## 📋 测试策略概述

[总体测试策略描述]

---

## 🎯 测试范围

| 范围类型 | 包含/排除 | 说明 |
|---------|-----------|------|
| 功能测试 | ✅ | [说明] |
| 性能测试 | ✅/❌ | [说明] |
| 安全测试 | ✅/❌ | [说明] |
| 兼容性测试 | ✅/❌ | [说明] |

---

## 📝 测试类型与优先级

| 测试类型 | 优先级 | 覆盖内容 | 预估工作量 |
|---------|--------|---------|-----------|
| [类型] | P0/P1/P2 | [内容] | [人天] |

---

## ⚠️ 风险分析与缓解

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|---------|
| [风险] | 高/中/低 | [影响] | [措施] |

---

## 📅 资源与进度估算

[资源需求、人员配置、时间进度建议]

---

## 📊 质量指标

[定义通过标准、质量门禁等指标]
"""},
    {"key": "test-points", "label": "提取测试点",
     "icon": "Target", "gradient": "from-violet-500 to-purple-600",
     "system_prompt": """你是一位资深的测试点分析专家。基于需求分析和测试方案，提取详细的测试点。

请严格按照以下Markdown格式输出测试点清单：

---

## 📋 测试点总览

[总体说明，包含测试点数量和覆盖范围]

---

## 🔍 功能测试点

| 编号 | 测试点 | 对应功能 | 优先级 | 测试类型 |
|------|--------|---------|--------|---------|
| TP-001 | [测试点名称] | [功能模块] | P0/P1/P2 | 功能/UI/边界 |
| TP-002 | ... | ... | ... | ... |

---

## 🔄 流程测试点

| 编号 | 测试点 | 涉及流程 | 优先级 | 说明 |
|------|--------|---------|--------|------|
| TP-00x | [测试点] | [流程名称] | P0/P1/P2 | [说明] |

---

## ⚡ 性能测试点

| 编号 | 测试点 | 指标 | 阈值 | 优先级 |
|------|--------|------|------|--------|
| TP-00x | [测试点] | [指标] | [阈值] | P0-P2 |

---

## 🔐 安全测试点

[如有安全测试点，列出]

---

## 📊 测试点统计

总测试点: X | P0: X | P1: X | P2: X
"""},
    {"key": "test-cases", "label": "用例生成",
     "icon": "FlaskConical", "gradient": "from-emerald-500 to-green-600",
     "system_prompt": """你是一位资深的测试用例设计专家。基于测试点清单，生成详细可执行的测试用例。

请严格按照以下Markdown格式输出测试用例：

---

## 📋 测试用例总览

[总体说明，包含用例数量和覆盖的测试点]

---

## ✅ 测试用例详情

### TC-001: [用例标题]

- **对应测试点**: TP-00x
- **优先级**: P0/P1/P2
- **测试类型**: 功能/性能/安全
- **前置条件**: [条件说明]
- **测试数据**: [数据描述]
- **测试步骤**:
  1. [步骤1操作] → [预期结果1]
  2. [步骤2操作] → [预期结果2]
- **预期结果**: [整体预期]

---

### TC-002: [用例标题]
...

---

## 📊 用例统计

总用例: X | P0: X | P1: X | P2: X | 覆盖测试点: X
"""},
    {"key": "test-review", "label": "用例评审",
     "icon": "CheckCircle", "gradient": "from-pink-500 to-rose-600",
     "system_prompt": """你是一位资深的测试用例评审专家。对生成的测试用例进行全面评审。

请严格按照以下Markdown格式输出评审报告：

---

## 📋 评审概述

[总体评价，包含评审范围和方法]

---

## ✅ 质量检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 用例完整性 | ✅/⚠️/❌ | [说明] |
| 步骤清晰度 | ✅/⚠️/❌ | [说明] |
| 预期结果明确性 | ✅/⚠️/❌ | [说明] |
| 测试数据充分性 | ✅/⚠️/❌ | [说明] |

---

## 📊 用例评估

| 用例编号 | 质量评分 | 评审意见 |
|---------|---------|---------|
| TC-001 | ⭐⭐⭐⭐⭐ | [评价] |
| TC-002 | ⭐⭐⭐⭐ | [评价] |

---

## 🔄 关联性分析

[分析用例之间的冗余、遗漏、依赖关系等]

---

## ⚠️ 问题与建议

| 问题类型 | 涉及用例 | 严重程度 | 改进建议 |
|---------|---------|---------|---------|
| [缺失/冗余/错误] | TC-00x | 高/中/低 | [建议] |

---

## 📊 评审总结

总体质量评分: X/10
通过用例: X | 需修改: X | 不通过: X
建议: [总体改进建议]
"""},
]


class PipelineService:
    """全流程编排器：按序执行5个Agent，SSE流式推送，DB持久化"""

    def __init__(self, db: Optional[AsyncSession] = None):
        from config import get_settings
        settings = get_settings()
        self.api_key = settings.OPENAI_API_KEY
        self.base_url = settings.OPENAI_BASE_URL
        self.model = settings.DEFAULT_LLM_MODEL
        self.db = db

    async def run_pipeline(self, requirement_content: str, requirement_name: str = "",
                           db: Optional[AsyncSession] = None) -> AsyncGenerator[str, None]:
        """
        执行全流程，SSE事件流：
          pipeline_start
          stage_start / stage_output* / stage_log* / stage_complete
          pipeline_complete

        所有阶段输出和SSE事件均实时打印到IDE终端。
        """
        pipeline_id = str(uuid.uuid4())[:8]
        total_start = time.time()

        session = db or self.db  # 优先使用参数传入的session

        logger.info(f"")
        logger.info(f"{'='*60}")
        logger.info(f"  🚀 Pipeline [{pipeline_id}] 启动全流程 (DB版)")
        logger.info(f"  📄 需求: {requirement_name or '(未命名)'}")
        logger.info(f"  🤖 模型: {self.model}")
        logger.info(f"  📐 内容长度: {len(requirement_content)} 字符")
        logger.info(f"{'='*60}")

        # pipeline_start
        yield self._event("pipeline_start", {
            "pipeline_id": pipeline_id,
            "total_stages": len(STAGES),
            "requirement_name": requirement_name,
        })
        logger.info(f"📡 [SSE→pipeline_start] pipeline_id={pipeline_id}, stages={len(STAGES)}")

        previous_output = requirement_content
        stage_results = []

        # ── 保存原始需求到 DB ──
        if requirement_content.strip() and session is not None:
            try:
                req = Requirement(
                    name=requirement_name or "未命名需求",
                    description=requirement_content,
                    source="manual",
                    status="draft",
                    pipeline_id=pipeline_id,
                )
                session.add(req)
                await session.commit()
                await session.refresh(req)
                logger.info(f"💾 [DB→requirements] 原始需求已保存 ID={req.id}")
            except Exception as e:
                logger.error(f"❌ [DB→requirements] 保存失败: {e}")
                await session.rollback()

        for stage_info in STAGES:
            stage_key = stage_info["key"]
            stage_label = stage_info["label"]
            order = STAGES.index(stage_info) + 1

            # stage_start
            stage_start_time = time.time()
            logger.info(f"")
            logger.info(f"  ┌─{'─'*56}┐")
            logger.info(f"  │  ▶ 阶段 {order}/5: {stage_label}  ")
            logger.info(f"  └─{'─'*56}┘")

            yield self._event("stage_start", {
                "stage": stage_key,
                "label": stage_label,
                "order": order,
                "icon": stage_info["icon"],
                "gradient": stage_info["gradient"],
            })
            logger.info(f"📡 [SSE→stage_start] stage={stage_key}, label={stage_label}")

            yield self._event("stage_log", {
                "stage": stage_key,
                "level": "AGENT",
                "message": f"🚀 启动{stage_label}Agent",
            })
            logger.info(f"🤖 [Agent] 启动 {stage_label} - 正在调用 API {self.model} ...")

            # 执行流式分析
            full_content = ""
            try:
                client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

                prompt = f"""当前阶段：{stage_label}

## 原始需求
{requirement_content}

## 已有分析上下文
{previous_output}

请按照要求的格式输出{stage_label}结果。"""

                logger.info(f"📤 [API→{self.model}] 发送请求 (prompt≈{len(prompt)}字符)")
                stream = await client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": stage_info["system_prompt"]},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.7,
                    max_tokens=8192,
                    stream=True,
                )

                chunk_count = 0
                async for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if delta and delta.content:
                            full_content += delta.content
                            chunk_count += 1
                            yield self._event("stage_output", {
                                "stage": stage_key,
                                "content": delta.content,
                            })
                            if chunk_count % 50 == 0:
                                logger.info(f"📡 [SSE→stage_output] {stage_key}: 已接收 {chunk_count} 个chunk (~{len(full_content)}字符)")

                logger.info(f"📥 [API←] {stage_label} 完成接收: {chunk_count} chunks, {len(full_content)} 字符")

                duration = round(time.time() - stage_start_time, 1)
                stage_results.append({"key": stage_key, "content": full_content, "duration": duration})

                yield self._event("stage_log", {
                    "stage": stage_key,
                    "level": "INFO",
                    "message": f"✅ {stage_label}完成，耗时 {duration}s",
                })
                logger.info(f"✅ [完成] {stage_label} - 耗时 {duration}s, 输出 {len(full_content)} 字符")

                yield self._event("stage_complete", {
                    "stage": stage_key,
                    "status": "completed",
                    "duration": duration,
                })
                logger.info(f"📡 [SSE→stage_complete] {stage_key} → completed ({duration}s)")

                # 将本阶段输出作为下一阶段的输入上下文
                previous_output = full_content

            except Exception as e:
                duration = round(time.time() - stage_start_time, 1)
                error_msg = str(e)
                logger.error(f"❌ [失败] {stage_label}: {error_msg}")
                import traceback
                logger.error(f"   └─ traceback: {traceback.format_exc()}")

                yield self._event("stage_log", {
                    "stage": stage_key,
                    "level": "ERROR",
                    "message": f"❌ {stage_label} 执行失败: {error_msg}",
                })
                logger.info(f"📡 [SSE→stage_log] {stage_key} → ERROR: {error_msg[:200]}")

                yield self._event("stage_error", {
                    "stage": stage_key,
                    "error": error_msg,
                    "duration": duration,
                })
                logger.info(f"📡 [SSE→stage_error] {stage_key} → duration={duration}s")

                # 即使失败也继续下一个阶段（用空上下文）
                stage_results.append({"key": stage_key, "content": "", "duration": duration})
                previous_output = f"【{stage_label}执行失败】{error_msg}"

        # pipeline_complete
        total_duration = round(time.time() - total_start, 1)
        yield self._event("pipeline_complete", {
            "pipeline_id": pipeline_id,
            "status": "completed",
            "total_duration": total_duration,
            "stage_results": [
                {"key": r["key"], "duration": r["duration"]}
                for r in stage_results
            ],
        })
        logger.info(f"📡 [SSE→pipeline_complete] completed, total_duration={total_duration}s")

        # ── 保存流程记录到 DB ──
        if session is not None:
            try:
                record = PipelineRecord(
                    name=f"Pipeline - {requirement_name or '未命名需求'}",
                    status="completed",
                    pipeline_id=pipeline_id,
                    requirement_content=requirement_content,
                    requirement_name=requirement_name or "未命名需求",
                    total_duration=total_duration,
                    stage_count=len(STAGES),
                    stage_results=[
                        {"key": r["key"],
                         "label": next((s["label"] for s in STAGES if s["key"] == r["key"]), r["key"]),
                         "content": r["content"], "duration": r["duration"]}
                        for r in stage_results
                    ],
                )
                session.add(record)
                await session.commit()
                await session.refresh(record)
                logger.info(f"💾 [DB→pipeline_records] 流程记录已保存 ID={record.id}")
            except Exception as e:
                logger.error(f"❌ [DB→pipeline_records] 保存失败: {e}")
                await session.rollback()

        logger.info(f"")
        logger.info(f"{'='*60}")
        logger.info(f"  ✅ Pipeline [{pipeline_id}] 全流程完成!")
        logger.info(f"  ⏱  总耗时: {total_duration}s")
        stage_summary = " → ".join([f"{r['key']}({r['duration']}s)" for r in stage_results])
        logger.info(f"  📊 各阶段: {stage_summary}")
        logger.info(f"  📝 结果已保存到 DB")
        logger.info(f"{'='*60}")
        logger.info(f"")

    def _event(self, event_type: str, data: dict) -> str:
        """格式化 SSE 事件"""
        return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
