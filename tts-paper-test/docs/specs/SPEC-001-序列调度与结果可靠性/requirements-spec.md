# SPEC-001 需求规格说明书 — 序列执行调度与生成结果可靠性

> 版本：v1.0 ｜ 日期：2026-10-18 ｜ 状态：已评审
> 关联模块：AI 全流程 Pipeline（需求分析 → 规划方案 → 提取测试点 → 用例生成 → 用例评审）

---

## 1. 背景与问题陈述

当前 AI 全流程（Pipeline）生成功能存在以下线上问题，用户反馈"**生成的各种结果不是没有成功就是缺失**"：

| 编号 | 问题 | 根因分析 | 严重度 |
|------|------|---------|--------|
| P-1 | 流程执行到一半，结果整体丢失 | `PipelineRecord` 仅在**全部阶段结束后**才写库；浏览器刷新 / 关闭页面 / 网络中断会直接取消 SSE 请求，后端生成器被垃圾回收，所有已产出内容丢失 | 高 |
| P-2 | 阶段"成功"但内容缺失（如测试点仅几百字符） | 免费模型限流（429）导致流式响应中途截断时**不抛异常**，残缺内容被标记为 `completed` | 高 |
| P-3 | 无法批量执行多个生成任务 | 现有接口一次仅能启动一条 5 阶段序列，无法排队、无法并行 | 中 |
| P-4 | 免费模型并发请求触发限流失败 | 调度层无"模型档位"概念，免费/付费模型同等对待 | 中 |
| P-5 | 工作流选择 Web 项目 500 报错 | `projects-for-workflow` 接口以属性方式访问 dict（`'dict' object has no attribute 'id'`），且存在 `p.status` 笔误 | 中 |
| P-6 | 前端序列语义不直观 | 步骤/任务未按"序列序号"强序展示，用户无法感知执行顺序与并行通道 | 低 |

## 2. 目标（Goals）

1. **G1 结果零丢失**：Pipeline 记录在启动时即落库（running 态），每个阶段完成后增量 checkpoint；客户端断连不再中断后端执行，刷新页面可重连接续传。
2. **G2 空/残缺结果可识别**：阶段输出低于阈值（<80 字符）视为失败并按既有策略重试；流被 `finish_reason=length` 截断时显式告警。
3. **G3 序列执行调度（核心新增）**：
   - 使用**免费模型**时 → **单任务序列**（串行）：同一时刻仅 1 个生成任务在执行，其余排队，避免限流失败。
   - 使用**付费模型**时 → **并行序列**：最多同时开启 N（默认 3，可配置）个任务并行执行，每个任务内部仍严格按 5 阶段顺序执行。
4. **G4 前端序列可视化**：执行模式徽标（🆓 串行 / 💎 并行×N）、序列任务中心按序号排列、并行通道（Lane）泳道视图、循环进度按序列推进。
5. **G5 缺陷修复**：修复 P-5 及验证中发现的全部报错，交付时全流程无报错。

## 3. 非目标（Non-Goals）

- 不改造工作流引擎（workflow_engine）的节点并行能力（其已有拓扑并行，与本次序列调度无关）。
- 不引入外部消息队列 / Celery；调度基于 FastAPI 进程内 asyncio（与现有架构一致）。
- 不改变 5 阶段之间的依赖关系（阶段间存在上下文传递，单序列内部必须串行）。

## 4. 功能需求（FR）

### FR-1 模型档位（Tier）体系
- FR-1.1 `LLMProvider` 新增字段：`tier`（`free`/`paid`，默认 `free`）、`max_concurrency`（并行上限，默认 1，付费默认 3）。
- FR-1.2 全局配置支持 `MODEL_TIER`（`auto`/`free`/`paid`，默认 `auto`）：`auto` 时读取当前启用 Provider 的 `tier`；无 Provider 时按 `DEFAULT_LLM_MODEL` 是否含 `free` 判定。
- FR-1.3 档位解析结果通过 `GET /api/v1/sequence/mode` 暴露：`{tier, mode, concurrency, model, provider_name}`。
- FR-1.4 SQLite 启动时自动补齐新增列（轻量迁移，无需 Alembic）。

### FR-2 序列任务调度器
- FR-2.1 支持一次提交多个生成任务（每个任务 = 一条完整 5 阶段 Pipeline 序列）。
- FR-2.2 免费模型：并发度=1，任务按提交顺序**单序列串行**执行，任务卡片显示序号与"排队中"状态。
- FR-2.3 付费模型：并发度=N，任务分配到 1..N 条并行通道（Lane）；通道内任务保持先来先服务。
- FR-2.4 任务失败不阻塞队列：失败任务标记 `failed`，后续任务继续执行。
- FR-2.5 调度事件通过 SSE 推送：`group_start / task_start / task_stage / task_complete / task_failed / group_complete`，支持 `since` 游标重放（断线重连不丢事件）。
- FR-2.6 调度组持久化 `SequenceGroup`（模式、并发度、任务快照、统计），完成后入库，可查询历史。
- FR-2.7 提供 **demo 模拟模式**：不调用真实 LLM，以可控延时模拟阶段执行，用于演示并行/串行差异（GitHub Pages Demo 采用同一状态机）。

### FR-3 结果可靠性
- FR-3.1 Pipeline 启动即创建记录（`status=running`）；每阶段完成后 checkpoint 更新 `stage_results`。
- FR-3.2 执行与 SSE 传输解耦：后端以独立任务驱动生成，客户端断开仅停止"订阅"，不终止执行。
- FR-3.3 阶段输出 <80 字符 → 判定失败，进入重试/报错路径（不再静默"假成功"）。
- FR-3.4 记录新增 `sequence_group_id`、`sequence_lane` 字段用于归组追溯。

### FR-4 前端显示优化
- FR-4.1 Pipeline 顶栏展示执行模式徽标（免费=🆓 单任务串行；付费=💎 并行×N）。
- FR-4.2 新增「序列任务中心」页面：模式卡片、任务提交（多条需求批量）、实时泳道视图（Lane 列 × 序号行）、任务状态/阶段进度/耗时/失败原因。
- FR-4.3 所有序列列表**严格按序号排序**（循环按序列），步骤侧栏/进度条带序号 ①-⑤。
- FR-4.4 运行中记录支持"查看/重连"入口（配合 FR-3.2）。

## 5. 验收标准（AC）

| AC | 描述 | 验证方式 |
|----|------|---------|
| AC-1 | 免费模型下批量提交 3 个模拟任务，任意时刻 running 任务 ≤1，序号严格递增推进 | 浏览器实测 + 事件日志 |
| AC-2 | 切付费档位后同批任务出现 ≥2 个任务同时在 Lane1/2 运行 | 浏览器实测 |
| AC-3 | Pipeline 执行中刷新页面，重新进入后状态/内容完整，最终记录 status=completed | 浏览器实测 + DB 校验 |
| AC-4 | 模拟阶段返回空内容 → 阶段显示 failed 且可"继续执行"重试 | 单元/浏览器验证 |
| AC-5 | `/api/v1/web-automation/projects-for-workflow` 返回 200 | API 测试 |
| AC-6 | 全流程浏览器逐模块巡检无 console error / 500 | Loop Engineering 截图留档 |

## 6. 影响范围

- 后端：`config.py`、`models/config.py`、`models/test_lifecycle.py`、`services/pipeline_service.py`、`services/sequence_scheduler.py`（新）、`api/pipeline.py`、`api/sequence.py`（新）、`api/web_automation.py`、`main.py`、schemas。
- 前端：`lib/api.ts`、`requirement-testing`（AIPipeline 顶栏、序列任务中心新页、菜单）。
- 文档：README、需求/技术/操作说明、GitHub Pages Demo。
