# TSS AI测试平台 — 模块功能完整性分析（现行版）

> 更新日期：2026-08-24　|　基于当前代码库实际状态梳理

## 总览

| 指标 | 数量 |
|------|------|
| 后端 API 模块 | 19 |
| 后端 API 端点 | 200+ |
| 数据模型 | 15 个模块 / ~55 模型 |
| 测试引擎 | 5 种（注册表驱动） |
| 前端页面目录 | 18 个 |
| 前端懒加载路由 | 40+ |
| 共享组件 | 7 个目录（ui/layout/crud/markdown/ai-assistant/log-panel/shared） |

---

## 一、核心完整模块（已对接真实 API）

### 1. 测试管理中心（`/test-management/*`）✅
当前最大的模块，带侧边栏布局，覆盖测试全生命周期：
- 需求测试：`requirements` / `plans` / `points` / `cases` / `reviews`
- 用例详情：`cases/:id`（嵌套布局壳内渲染）
- 执行管理：`executions` / `schedules`
- 缺陷管理：`defects` / `kanban` / `root-cause` / `trend`
- 分析报告：`reports` / `ai-report` / `quality`
- AI 全流程：`pipeline`（页内 3 Tab：流程/生成记录/步骤提示词）/ `records`
- 组织管理：`ProjectManagement` / `VersionManagement` / `UserManagement` / `RoleManagement` / `StepPromptConfig`
- 平台对标：`comparison`（CompetitorAnalysisPage）

### 2. 认证模块 ✅
- LoginPage / RegisterPage
- API: `/api/v1/auth`（登录/注册/Token 刷新）
- 完整度: 100%

### 3. 需求测试全流程 ✅
- RequirementTestingPage / AIPipeline / ProcessRecords
- API: `/api/v1/test-lifecycle` + `/api/v1/pipeline` + `/api/v1/data` 完整 CRUD
- 完整度: 95%

### 4. AI Web 自动化（`/ai-web-automation`）✅
- ProjectList / AiAgentPanel / AiExploration / ObjectRepository / TestCaseManager / EngineSelector
- API: `/api/v1/web-automation` 完整 CRUD + WebSocket 实时推送
- 引擎选择：Midscene.js / Playwright MCP / Browser Use / UI-TARS / Mock
- 完整度: 90%

### 5. AI 用例生成（`/ai-automation`）✅
- AiAutomationHub / AiTestTypeDetail（按测试类型 5 步流水线）
- API: `/api/v1/pipeline` / `/api/v1/ai-test-tasks`
- 完整度: 85%

### 6. 知识库（`/knowledge-base`）✅
- 测试模式库 + Bug 知识库 + RAG 搜索
- API: `/api/v1/knowledge`（含 AI 语义搜索）
- 完整度: 85%

### 7. 工作流编排（`/workflow-orchestration`）✅
- WorkflowEditorPage（SVG DAG 画布）
- API: `/api/v1/workflows`（Workflow/Node/Edge/Execution）
- 完整度: 85%

### 8. 数据工厂（`/data-factory`）✅
- DataFactoryPage
- API: `/api/v1/data-factory`
- 完整度: 80%

### 9. 系统管理（`/system-management`）✅
- 环境 / LLM / 提示词 / 风格 / MCP / Skills / 步骤提示词 / 健康历史
- API: `/api/v1/config`（60+ 端点）
- 完整度: 90%

---

## 二、独立管理与执行模块（已对接真实 API）

### 10. 执行管理（`/execution-management`）
- ExecutionList / ExecutionDetail
- API: `/api/v1/test-lifecycle` 执行相关 + SSE 流
- 完整度: 85%

### 11. 缺陷管理（`/defect-management`）
- DefectList + 看板 + AI 根因分析 + 趋势图表
- API: `/api/v1/test-lifecycle` 缺陷相关 + AI 分析
- 完整度: 90%

### 12. 分析报告（`/report-management`）
- ReportList / AI 报告 / 质量概览 / 趋势图表
- API: `/api/v1/test-lifecycle` 报告相关 + AI 生成
- 完整度: 90%

### 13. 用户/角色管理
- UserManagementPage（`/users`）+ RoleManagement
- API: `/api/v1/users` + `/api/v1/roles`（CRUD、状态、登录日志、设备）
- 完整度: 85%

---

## 三、后端专项能力模块（后端 API 已实现，前端部分集成）

| 模块 | API 前缀 | 说明 |
|------|---------|------|
| AI 接口自动化 | `/api/v1/api-test` | OpenAPI 驱动接口用例生成与执行 |
| AI App 自动化 | `/api/v1/app-test` | App 自动化测试 |
| AI 通用测试任务 | `/api/v1/ai-test-tasks` | 通用 AI 测试任务调度 |
| 项目管理 | `/api/v1/projects` | 项目与版本管理 |
| MCP 市场 | `/api/v1/mcp-marketplace` | MCP 服务市场管理与安装 |
| AI 对话 | `/api/v1/ai` | AI 智能助手对话 |
| 引擎管理 | `/api/v1/engines` | 引擎列表/切换/健康检查 |
| 需求数据 | `/api/v1/data` | 需求测试各阶段数据管理 |

---

## 四、测试引擎体系

| 引擎 | 类型标识 | 状态 |
|------|---------|------|
| MockEngine | `mock` | 可用（模拟） |
| MidsceneEngine | `midscene` | 可用（视觉驱动） |
| PlaywrightMCPEngine | `playwright_mcp` | 可用（MCP 浏览器自动化） |
| BrowserUseEngine | `browser_use` | 预留 |
| UITarsEngine | `ui_tars` | 预留 |

引擎通过 `EngineRegistry` 注册表统一管理，前端 `EngineSelector` 组件提供切换入口。

---

## 五、建议完善项（优先级）

### P0 — 核心能力补强
1. **App / 接口自动化前端集成**：后端 API 已就绪，前端页面目录尚未落地，需要补充对应页面组件与路由
2. **MCP 市场深度集成**：市场列表已实现，可增强安装/配置流程的前端体验

### P1 — 体验优化
3. **Dashboard 统计维度**：增加更多质量与效率维度
4. **活动/操作日志**：增加筛选、导出功能

### P2 — 工程化
5. 测试覆盖提升：补充引擎与 workflow 的单元测试
6. 生产环境迁移：SQLite → PostgreSQL 的迁移与 CI/CD 流水线完善

---

## 六、跨模块协作关系

```
用户认证/授权
   │
   ▼
需求分析(requirement_agent) ──► 测试点 ──► 用例生成(test_generator)
   │                                       │
   ▼                                       ▼
知识库(RAG) ◄── 缺陷沉淀 ◄── 执行(execution_agent) ──► 评审
                                           │
                                           ▼
                                    报告生成(ai_report) ──► 质量概览
   │
   └── 工作流编排(workflow_engine) 可编排以上任意节点
```