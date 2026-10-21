# SPEC-001 技术设计说明书 — 序列执行调度与生成结果可靠性

> 版本：v1.0 ｜ 关联：`requirements-spec.md` ｜ 架构约束：FastAPI + SQLAlchemy 2.0 async + React 19 + SSE，不引入新外部依赖

---

## 1. 总体架构

```
┌──────────────────────────── 前端 ────────────────────────────┐
│ AIPipeline(顶栏模式徽标)   SequenceCenter(序列任务中心·新)     │
│        │ fetch SSE                    │ fetch SSE(since 重放) │
└────────┼──────────────────────────────┼──────────────────────┘
         ▼                              ▼
┌──────────────────────────── 后端 ────────────────────────────┐
│ api/pipeline.py          api/sequence.py(新)                  │
│   /start(SSE)              /mode  /runs(POST/GET)             │
│   /runs/{id}/replay        /runs/{id}/stream(SSE)             │
│        │                      │                               │
│        ▼                      ▼                               │
│ PipelineService        SequenceScheduler(新)                  │
│  · 阶段增量checkpoint    · 档位→并发度 映射                    │
│  · 断连不终止执行        · Semaphore 泳道调度                  │
│  · 空输出判失败          · 事件缓冲+since 重放                 │
│        │                      │ 派生 N×PipelineService        │
│        ▼                      ▼                               │
│ pipeline_records    sequence_groups + 子pipeline_records       │
└───────────────────────────────────────────────────────────────┘
```

## 2. 数据模型变更

### 2.1 `llm_providers` 增列（models/config.py）
```python
tier: str            # "free" | "paid"，默认 "free"
max_concurrency: int # 并行上限，默认 1
```

### 2.2 新表 `sequence_groups`（models/sequence.py）
```python
class SequenceGroup(Base, TimestampMixin):
    id, name, status(running/completed/failed/partial), 
    mode(serial/parallel), concurrency(int), tier(free/paid),
    model(str), total_tasks, done_tasks, failed_tasks,
    tasks(JSON: 任务快照含 lane/order/status/duration/error),
    total_duration(float), simulated(bool)
```

### 2.3 `pipeline_records` 增列
```python
sequence_group_id: int | None   # 归属调度组
sequence_lane: int | None       # 并行通道号（串行恒为 1）
```

### 2.4 轻量迁移（database.py 启动钩子）
`_ensure_columns()`：`PRAGMA table_info(...)` 对比缺列则 `ALTER TABLE ADD COLUMN`，保证既有 SQLite 库无损升级。

## 3. 调度器设计（services/sequence_scheduler.py）

### 3.1 档位解析
```python
def resolve_mode(settings, provider) -> dict:
    tier = settings.MODEL_TIER          # auto|free|paid
    if tier == "auto":
        tier = provider.tier if provider else ("free" if "free" in settings.DEFAULT_LLM_MODEL else "paid")
    if tier == "free":
        return {"tier":"free",  "mode":"serial",   "concurrency":1}
    return  {"tier":"paid",  "mode":"parallel", "concurrency":min(settings.MAX_PARALLEL_SEQUENCES, provider.max_concurrency or 3)}
```

### 3.2 执行模型
- `SequenceScheduler.run(group)`：为每个任务 `asyncio.create_task(_worker(task, lane))`；`_worker` 获取 `Semaphore(concurrency)` 后执行：
  - 真实模式：调用 `PipelineService.run_pipeline(...)`（复用现有 5 阶段逻辑，注入 `sequence_group_id/lane`），逐事件解析 SSE 字符串转为组事件。
  - 模拟模式（`simulated=true`）：每阶段 `asyncio.sleep(1.2~2.4s)` 产出内置演示 Markdown，用于前端演示与 GitHub Demo 数据生成。
- Lane 分配：`lane = (启动序号 % concurrency) + 1`；串行模式恒 Lane 1。
- **单序列内阶段仍严格串行**（上下文依赖），并行发生在"任务与任务之间"。

### 3.3 事件总线与断线重放
- 组内存态 `GroupRuntime { events: list, cursor: asyncio.Condition }`（模块级 dict，进程内共享）。
- SSE 端点 `GET /runs/{id}/stream?since=N`：先重放 `events[N:]`，再条件变量等待新事件；完成事件后关闭。
- 客户端断开仅结束订阅协程，`_worker` 不受影响 → 根治"断连即丢结果"。

## 4. PipelineService 可靠性改造（services/pipeline_service.py）

1. **启动即建记录**：无 `record_id` 时先生成 `PipelineRecord(status="running", stage_results=[])` 提交，后续持有该记录对象。
2. **阶段 checkpoint**：每阶段 `stage_complete` 后立即 `UPDATE pipeline_records SET stage_results=..., status='running'`。
3. **空/残缺判定**：流结束后 `len(full_content.strip()) < 80` → 抛 `EmptyOutputError` 走阶段失败路径（前端显示 failed，可继续执行）；采集 `finish_reason=="length"` 记录告警日志。
4. **断连不终止**：API 层改为 `asyncio.create_task(service.run_and_persist(...))` + 事件入组缓冲；`StreamingResponse` 从缓冲读取。生成器由后台任务驱动，不再随 HTTP 断开而 cancel。
5. 失败阶段 checkpoint 写入 `status:"failed"` + error，前端"继续执行"（resume_from + record_id）沿用现有协议。

## 5. API 设计（api/sequence.py，前缀 /api/v1/sequence）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/mode` | 当前档位/模式/并发度（FR-1.3） |
| POST | `/runs` | 创建调度组并启动：`{name, simulated, tasks:[{requirement_name, requirement_content, project_id, version_id}]}` |
| GET | `/runs` | 分页历史（DB） |
| GET | `/runs/{id}` | 快照（运行中读内存态，已结束读 DB） |
| GET | `/runs/{id}/stream?since=` | SSE 事件流（重放+订阅） |
| POST | `/runs/{id}/cancel` | 取消未执行任务（标记 cancelled） |

## 6. 前端设计

### 6.1 新增页面 `pages/requirement-testing/pages/SequenceCenter.tsx`
- 菜单 `sequence` 接入 `RequirementTestingPage`（Sidebar 增加「序列任务」）。
- 区块：①模式卡（档位徽标/并发度/切换说明）②任务编辑区（名称+内容+“添加任务”，支持多条）③泳道视图（`grid-cols-{N}`，每 Lane 一列，任务卡片按 order 降序排列，含状态点/阶段进度 5 格/耗时）④事件日志。
- 状态机：`useSSEStream` 复用，`since` 游标存 ref 实现重连。

### 6.2 AIPipeline 顶栏（PipelineHeader）
- 挂载时 `GET /sequence/mode` → 右侧徽标：`🆓 免费模型 · 单任务串行` / `💎 付费模型 · 并行×N`。
- 步骤组件加序号（①…⑤），体现"循环按序列"。

### 6.3 api.ts
- `sequenceApi = { getMode, createRun, listRuns, getRun, streamRun }`。

## 7. 缺陷修复清单

| 位置 | 修复 |
|------|------|
| `api/web_automation.py:815` | dict 访问改 `p["id"]/p["name"]/p["target_url"]/p["status"]`，修正 `p.status` 笔误 |
| PipelineService resume | `stage_results` 兼容 `duration_ms/duration` 双键 |
| `pipeline.py` | 断连保护（见 §4.4） |

## 8. 兼容性与风险

- **多进程部署**：内存事件总线仅限单 worker（当前 uvicorn 单进程开发模式成立）；README 标注多 worker 需换 Redis Pub/Sub 的演进路径。
- **旧记录**：`sequence_*` 列可空，旧数据不受影响。
- **免费模型限流**：串行模式下理论不再触发并发 429；保留指数退避重试。
- **回滚**：新表/新列均为增量，删除路由注册即可降级。
