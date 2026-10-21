# TSS AI测试平台 — 系统架构文档（v3 现行版）

> 版本：v1.0.0　|　更新日期：2026-08-24　|　本文档基于当前代码库实际状态梳理，替代早期 ARCHITECTURE-v1/v2。

## 1. 文档目的

本架构文档面向**开发者与运维人员**，基于 `frontend/`、`backend/` 目录实时代码梳理，描述 TSS（Test System Service）AI 软件测试平台的现行系统架构，包括技术栈、模块划分、数据模型、引擎体系、API 路由、核心业务流程与扩展点。

## 2. 系统总览

TSS 是一个**AI 驱动的软件测试全生命周期平台**。平台通过 AI Agent 自动完成从需求分析、用例生成、测试执行到缺陷管理与报告生成的全流程，同时提供可视化的 AI Web 自动化、接口自动化、App 自动化、工作流编排等能力。

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 React 19 SPA                         │
│   18 个页面模块 · 40+ 懒加载路由 · Zustand + TanStack Query        │
└──────────────┬────────────────────────────────────────────────────┘
               │  REST (OpenAPI 3.1) / WebSocket / SSE
┌──────────────▼────────────────────────────────────────────────────┐
│                   后端 FastAPI（Python 3.12）                     │
│  19 个 API 模块（/api/v1） · SQLAlchemy 2.0 异步 ORM                │
│  Agents（需求/探索/执行/生命周期）· Engines（5种引擎）              │
│  Services（Pipeline / Workflow / Knowledge / Config）             │
└──────────────┬────────────────────────────────────────────────────┘
               │
  ┌────────────┼─────────────┬──────────────┐
  ▼            ▼             ▼              ▼
SQLite/PostgreSQL   LLM Provider  Chrome/Appium    MCP 服务市场
(开发/生产)          (OpenAI/DashScope) (5种测试引擎)   (第三方工具集成)
```

## 3. 技术栈

### 3.1 前端（`frontend/`）

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架（严格模式 + 并发特性） |
| Vite | 8.x | 构建工具（代码分割 + 懒加载） |
| TypeScript | 6.x | 类型安全 |
| Tailwind CSS | 4.x | 样式系统（utility-first） |
| Zustand | 5.x | 全局状态管理 |
| TanStack Query | 5.x | 服务端状态缓存 |
| React Router | 7.x | 客户端路由 |
| Recharts | 3.x | 图表可视化 |
| Framer Motion | 12.x | 交互动画 |
| Lucide React | 1.x | 图标库 |
| Sonner | - | Toast 通知 |
| react-markdown | - | Markdown 渲染 |

### 3.2 后端（`backend/`）

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115.x | Web 框架（异步） |
| SQLAlchemy | 2.0.x | ORM（异步 AsyncSession） |
| SQLite / PostgreSQL | - | 开发 / 生产数据库 |
| Pydantic | 2.x | 数据校验与 Schema |
| Loguru | 0.7.x | 结构化日志 |
| passlib / python-jose | - | 密码哈希与 JWT |

### 3.3 AI 与自动化

| 技术 | 用途 |
|------|------|
| OpenAI SDK | LLM 对话（默认模型 `hy3-free`） |
| 阿里云 DashScope | qwen-vl-max 视觉模型 |
| midscene.js | 视觉驱动网页自动化 |
| Playwright MCP | MCP 协议浏览器自动化 |
| Browser Use | Python AI Agent 浏览器驱动（预留） |
| UI-TARS | 字节跳动多模态 GUI Agent（预留） |

## 4. 后端分层架构

遵循 **api → services → models 三层架构**，另含 engines（测试引擎抽象层）与 agents（AI 智能体层）。

```
backend/
├── api/            # 路由层（19 模块）：HTTP 入口、参数校验、鉴权
├── agents/         # AI 智能体层：需求分析/网页探索/用例生成/执行
├── engines/        # 测试引擎抽象层：统一引擎接口 + 5 种引擎实现
├── services/       # 业务逻辑层：Pipeline/Workflow/Knowledge/Config 等
├── models/         # ORM 数据模型层（SQLAlchemy）
├── schemas/        # Pydantic 校验模型
├── core/           # 横切关注点：安全、日志、异常
├── main.py         # FastAPI 应用入口与装配
└── database.py     # 数据库连接与会话工厂
```

### 4.1 引擎体系（`engines/`）

以 `BaseEngine` 抽象基类定义统一接口，通过 `EngineRegistry` 注册表解耦引擎实现。

**统一接口（`BaseEngine`）：**
- `explore(url)` — 网页探索
- `execute_test_case(...)` — 单用例执行
- `execute_test_suite(...)` — 用例集执行
- `generate_test_cases(...)` — AI 用例生成
- `health_check()` — 引擎健康检查
- `cleanup()` — 资源清理

**已注册引擎（`EngineRegistry`，5 种）：**

| 引擎 | 类型标识 | 说明 |
|------|---------|------|
| MockEngine | `mock` | 模拟引擎（开发/测试用） |
| MidsceneEngine | `midscene` | midscene.js 视觉驱动 |
| PlaywrightMCPEngine | `playwright_mcp` | Playwright MCP 浏览器自动化 |
| BrowserUseEngine | `browser_use` | Python AI Agent 驱动（预留） |
| UITarsEngine | `ui_tars` | UI-TARS 多模态 GUI Agent（预留） |

### 4.2 数据模型层（`models/`）

共 **15 个模型模块**，以 `Base`（SQLAlchemy）为基类，公共字段通过 `TimestampMixin`（`created_at`/`updated_at`）混入。

| 模型模块 | 主要模型 | 说明 |
|---------|---------|------|
| `user.py` | User、Role、UserDevice | 用户、角色、设备 |
| `project.py` | Project、Version | 项目与版本 |
| `test_lifecycle.py` | Requirement、TestPlan、TestPoint、TestCase、TestExecution、Defect、Review、PipelineRecord、TestReport、Schedule | 测试生命周期 10 类 |
| `web_automation.py` | WebAutomationProject、WebPage、WebUIElement、WebTestCase、WebTestExecution、AIDraft | AI Web 自动化 6 类 |
| `api_test.py` |（6 类） | 接口自动化 |
| `app_automation.py` |（5 类） | App 自动化 |
| `workflow.py` | Workflow、WorkflowNode、WorkflowEdge、WorkflowExecution、WorkflowNodeExecution | DAG 工作流 5 类 |
| `config.py` | Environment、LLMProvider、PromptTemplate、DeAIStyle、MCPService、Skill、HermesChannel、HealthHistory、StepPromptConfig、LLMUsageLog | 系统配置 10 类 |
| `knowledge.py` |（3 类） | 测试模式库、Bug 库 |
| `data_factory.py` |（1 类） | 数据工厂 |
| `ai_test_task.py` |（1 类） | AI 通用测试任务 |
| `device.py` / `operation_log.py` / `base.py` |（各 1 类） | 设备、操作日志、基类 |

### 4.3 业务逻辑层（`services/`）

| 服务 | 职责 |
|------|------|
| `pipeline_service.py` | AI 全流程流水线编排（需求→用例→执行→报告） |
| `workflow_engine.py` | DAG 工作流图遍历、节点执行、状态机 |
| `knowledge_service.py` / `ai_knowledge_service.py` | 知识库 CRUD + RAG 语义检索 |
| `ai_report_service.py` | AI 报告生成 |
| `web_automation_service.py` | Web 自动化项目/页面/对象/用例/执行业务 |
| `api_test_service.py` | 接口自动化业务 |
| `config_service.py` | 系统配置项管理 |
| `test_lifecycle_service.py` | 测试生命周期业务编排 |
| `auth_service.py` / `project_service.py` / `log_service.py` | 认证、项目、日志 |
| `execution_engine.py` | 测试执行引擎 |
| `document_parser.py` | 需求/文档解析 |
| `storage_service.py` | 文件存储 |

### 4.4 AI 智能体层（`agents/`）

| Agent | 职责 |
|-------|------|
| `base_agent.py` | Agent 抽象基类 |
| `requirement_agent.py` | 需求分析，抽取功能点/测试点 |
| `web_explorer.py` | 网页自主探索，识别元素与操作路径 |
| `test_generator.py` | 基于探索结果生成测试用例 |
| `execution_agent.py` | 执行测试并收集结果 |
| `lifecycle_agents.py` | 生命周期各阶段协同 Agent |

## 5. API 路由体系

后端共 **19 个 API 模块**，绝大多数挂载于 `/api/v1` 前缀，另含 WebSocket 与 SSE 实时通道。统一使用 Pydantic 校验、JWT 鉴权、结构化错误响应。

| 模块 | 前缀 | 主要端点 |
|------|------|---------|
| 认证 | `/api/v1/auth` | 登录、注册、Token 刷新 |
| 用户管理 | `/api/v1/users` | 用户 CRUD、状态、登录日志、设备 |
| 角色管理 | `/api/v1/roles` | 角色与权限管理 |
| 测试生命周期 | `/api/v1/test-lifecycle` | 需求/计划/测试点/用例/执行/缺陷/评审/报告/调度（70+ 端点） |
| AI Web自动化 | `/api/v1/web-automation` | 项目/页面/对象库/用例/执行 + WebSocket 实时推送 |
| AI接口自动化 | `/api/v1/api-test` | OpenAPI 驱动接口用例生成与执行 |
| AI App自动化 | `/api/v1/app-test` | App 自动化测试 |
| AI通用测试任务 | `/api/v1/ai-test-tasks` | 通用 AI 测试任务 |
| 数据工厂 | `/api/v1/data-factory` | 测试数据构造 |
| 项目管理 | `/api/v1/projects` | 项目、版本管理 |
| 全流程Pipeline | `/api/v1/pipeline` | 端到端流水线触发与状态查询 |
| 需求数据 | `/api/v1/data` | 需求测试各阶段数据管理 |
| 基础配置 | `/api/v1/config` | 环境/LLM/提示词/风格/MCP/Skills/步骤提示词等（60+ 端点） |
| 知识库 | `/api/v1/knowledge` | 测试模式库、Bug 库、RAG 搜索 |
| AI对话 | `/api/v1/ai` | AI 智能助手对话 |
| 引擎管理 | `/api/v1/engines` | 引擎列表/切换/健康检查 |
| MCP市场 | `/api/v1/mcp-marketplace` | MCP 服务市场管理 |
| 工作流编排 | `/api/v1/workflows` | DAG 工作流 CRUD + 执行 |
| —（SSE） | `/events` | 服务端事件实时推送 |

## 6. 前端架构

### 6.1 页面模块（`pages/`，18 个目录）

| 目录 | 路由 | 说明 |
|------|------|------|
| `auth` | `/login`, `/register` | 登录注册 |
| `dashboard` | `/`, `/activities` | 仪表盘、活动动态 |
| `test-management` | `/test-management/*` | **测试管理中心**：需求/计划/测试点/用例/评审/执行/缺陷/看板/根因/趋势/报告/AI报告/质量/平台对标/AI全流程/记录/步骤提示词/用户/角色/项目/版本 |
| `requirement-testing` | `/requirement-testing` | 需求测试 5 步流程 + AI Pipeline |
| `test-cases` | `/test-cases` | 测试用例库 |
| `ai-automation` | `/ai-automation`, `/ai-automation/:typeId` | AI 用例生成中心（按类型） |
| `ai-web-automation` | `/ai-web-automation` | AI Web 自动化（项目/智能体/探索/对象库/用例/执行） |
| `api-test` | - | 接口自动化 |
| `app-automation` | - | App 自动化 |
| `data-factory` | `/data-factory` | 数据工厂 |
| `execution-management` | `/executions` | 执行管理 |
| `defect-management` | `/defects`, `/kanban`, `/root-cause`, `/trend` | 缺陷管理 |
| `report-management` | `/reports`, `/ai-report`, `/quality` | 分析报告 |
| `user-management` | `/users` | 用户管理 |
| `system-management` | - | 系统管理（环境/LLM/提示词/MCP/Skills） |
| `knowledge-base` | `/knowledge-base` | 知识库 RAG |
| `mcp-marketplace` | `/mcp-marketplace` | MCP 市场 |
| `workflow-editor` | `/workflow-orchestration` | DAG 工作流编排 |
| `competitor-analysis` | `/test-management/comparison` | 平台对标分析 |

### 6.2 共享组件（`components/`）

- `layout/` — 布局框架（侧边栏、顶栏、导航）
- `ui/` — 基础 UI 组件（Button、Modal、ConfirmDialog 等）
- `crud/` — 通用 CRUD 表格组件（`CrudTable`）
- `markdown/` — Markdown 渲染与预览
- `ai-assistant/` — AI 智能助手浮动面板
- `log-panel/` — 日志面板
- `shared/` — 通用工具组件

### 6.3 状态管理

- **Zustand**：全局 UI 状态（主题、侧边栏、用户会话）
- **TanStack Query**：服务端数据请求缓存、乐观更新、失效重取

## 7. 核心业务流程

### 7.1 AI Web 自动化

```
用户描述测试意图
      ↓
 AI智能体面板（自然语言规划）
      ↓
 EngineSelector 选择测试引擎（5选1）
      ↓
  URL探索(web_explorer) → 页面分析 → 对象库(WebUIElement)
      ↓
  AI用例生成(WebTestCase) → 用例评审
      ↓
  测试执行(WebTestExecution) → 缺陷记录 → 报告
```

### 7.2 AI 全流程 Pipeline

```
PipelineRecord 触发（文档/需求输入）
      ↓
 requirement_agent 需求分析 → 抽取功能点/测试点
      ↓
 test_generator 用例生成（TestPoint → TestCase）
      ↓
 评审(Review) → 执行(TestExecution)
      ↓
 AI报告(TestReport) 生成 → 质量概览
```

### 7.3 工作流编排

```
SVG DAG 画布编辑（Workflow/Node/Edge 持久化）
      ↓
 WorkflowEngine 拓扑遍历
      ↓
 逐节点执行（WorkflowNodeExecution 记录状态）
      ↓
 汇总 WorkflowExecution 结果
```

## 8. 安全设计

- **认证**：JWT Bearer Token，密码 passlib 哈希
- **鉴权**：依赖注入 `get_current_user_dep`，各路由按需校验
- **配置**：`SECRET_KEY` 强制通过 `.env` 覆盖，默认值启动时告警
- **输入校验**：Pydantic 全量校验
- **日志**：Loguru 结构化日志，`core/logging_config.py` 统一配置

## 9. 部署与运行

### 9.1 本地开发

```bash
# 后端
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
# API文档: http://localhost:8000/docs

# 前端
cd frontend
npm install && npm run dev
# 访问: http://localhost:5173（/api 代理到 8000）
```

### 9.2 测试

| 类型 | 工具 | 说明 |
|------|------|------|
| 后端单元/接口测试 | pytest + pytest-asyncio + httpx | 测试 API 路由 |
| E2E 测试 | Playwright | `playwright.config.ts` + `e2e/` |
| 前端类型检查 | TypeScript strict | 全量类型检查 |

## 10. 扩展点与演进建议

1. **数据库生产化**：开发用 SQLite，生产切换 PostgreSQL（当前 `main.py` 启动时自动建表）
2. **引擎插件化**：基于 `EngineRegistry.register()` 可便捷注册新测试引擎
3. **Agent 编排**：`workflow_engine` 已支持 DAG，可扩展更多节点类型与子流程
4. **MCP 生态**：`mcp-marketplace` 提供第三方工具集成入口
5. **多 Provider LLM**：`LLMProvider` 模型已预留多供应商切换，当前默认 `hy3-free`

## 11. 相关文档

| 文档 | 内容 |
|------|------|
| `README.md` | 快速开始、功能概览、API 概览 |
| `MODULE-ANALYSIS.md` | 模块划分与职责分析 |
| `PRD-v1.md` / `功能点清单-v1.md` | 产品需求与功能点 |
| `frontend-design-spec.md` | 前端设计规格 |
| `STARTUP-GUIDE.md` | 启动指南 |
| `架构设计-v1/v2.md` | 早期架构草案（已被本文档取代） |