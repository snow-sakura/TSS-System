# TSS-System AI 协作开发规范

> 本文件是 AI 辅助开发的强制性规则。所有 AI 代理（包括 QoderCN、子代理、工作流代理）在本项目中必须遵守以下规范。

---

## 1. 语言规则（强制）

### 1.1 中文回复规则

**所有 AI 回复内容必须严格使用简体中文。** 此规则适用于：

- 所有对话回复、解释、建议
- 代码注释（除非是技术术语或已有英文注释的上下文）
- 提交信息（commit message）的说明部分
- 文档、README、设计文档
- 错误提示和用户界面文本
- 日志输出信息

### 1.2 例外情况

以下内容保持英文：

- 代码标识符（变量名、函数名、类名、文件名）
- 技术命令和 CLI 指令
- URL 和文件路径
- 第三方库的 API 调用
- 配置文件中的 key 值

### 1.3 专业术语标注

首次出现的专业术语需标注英文原文，格式为「中文（English）」，例如：
- 依赖注入（Dependency Injection）
- 面向切面编程（AOP）
- 持续集成（CI/CD）

### 1.4 标点符号

- 使用中文标点符号（，。、；：？！""''（）【】）
- 代码块内的标点保持英文

---

## 2. 角色定义与协作流程

### 2.1 角色矩阵

| 角色 | 职责 | 权限模型 |
|------|------|----------|
| **产品经理（PM）** | 需求分析、PRD 编写、优先级排序 | 只读 + 写文档 |
| **架构师（Architect）** | 系统设计、技术选型、ADR | 只读 + 分析 |
| **AI 软件工程师** | 前后端开发、API 实现、集成 | 完全读写 |
| **AI 测试工程师** | 测试策略、用例设计、自动化测试 | 只读 + 执行测试 |
| **AI Agent 工程师** | AI 智能体开发、MCP 集成、工作流引擎 | 完全读写 |
| **AI 设计师** | UI/UX 设计、交互设计、设计系统 | 只读 + 写设计文件 |
| **安全审计员** | 安全扫描、漏洞分析、合规检查 | 只读 |

### 2.2 标准开发流程

```
需求分析(PM) → 架构设计(Architect) → 开发实现(Engineer) → 测试验证(Tester) → 安全审查(Security) → 部署上线
```

### 2.3 质量门禁

- 代码必须通过 lint 检查和类型检查
- 核心模块测试覆盖率 >= 90%，整体 >= 80%
- 所有 API 必须有 OpenAPI 文档
- 安全扫描无高危漏洞
- 关键决策必须有 ADR（Architecture Decision Record）

---

## 3. 代码规范

### 3.1 前端（React + TypeScript）

- **框架**: React 19 + TypeScript + Vite
- **样式**: Tailwind CSS v4（utility-first）
- **状态管理**: Zustand（全局状态）+ TanStack Query（服务端状态）
- **命名规范**:
  - 组件: PascalCase（`ModulePage.tsx`）
  - Hook: camelCase（`useModuleData.ts`）
  - 工具函数: camelCase（`utils.ts`）
  - 常量: UPPER_SNAKE_CASE
  - CSS 类: kebab-case 或 Tailwind utility
- **禁止事项**:
  - 禁止使用 `any` 类型（定义接口）
  - 禁止 `dangerouslySetInnerHTML`（使用 react-markdown）
  - 禁止 `window.confirm()`（使用 ConfirmDialog）
  - 禁止 `console.log/error`（使用 toast 通知）
  - 禁止硬编码 URL 和 IP 地址

### 3.2 后端（FastAPI + Python）

- **框架**: FastAPI + SQLAlchemy 2.0 (async)
- **数据库**: SQLite（开发）/ PostgreSQL（生产）
- **命名规范**:
  - 文件: snake_case（`test_lifecycle.py`）
  - 类: PascalCase（`TestCaseService`）
  - 函数: snake_case（`get_test_cases`）
  - 常量: UPPER_SNAKE_CASE
- **分层架构**: `api/`（路由）→ `services/`（业务逻辑）→ `models/`（ORM）
- **所有 API**: 前缀 `/api/v1`，RESTful 风格

### 3.3 Git 规范

- **分支**: `main`（生产）、`feature/*`（功能）、`fix/*`（修复）
- **提交格式**: `type(scope): 描述`
  - type: feat / fix / refactor / test / docs / chore / perf / style
  - 描述使用中文
- **PR 要求**: 必须通过 CI 检查（lint + typecheck + test + build）

---

## 4. AI 软件研发生命周期（AI-SDLC）

### 4.1 需求阶段

1. **需求收集**: 使用 AI 辅助分析用户需求，生成用户故事
2. **需求分析**: AI 自动提取功能点、非功能需求、约束条件
3. **需求评审**: AI 检查需求完整性、一致性、可行性
4. **PRD 生成**: AI 辅助生成产品需求文档

### 4.2 设计阶段

1. **架构设计**: AI 基于需求推荐系统架构，生成 C4 模型图
2. **API 设计**: AI 生成 OpenAPI 规范，定义接口契约
3. **数据库设计**: AI 生成 ER 图和 DDL 脚本
4. **UI/UX 设计**: AI 辅助生成线框图和交互流程

### 4.3 开发阶段

1. **任务分解**: AI 将需求拆解为可执行的开发任务
2. **代码生成**: AI 辅助编写业务代码，遵循项目规范
3. **代码审查**: AI 自动检查代码质量、安全漏洞、性能问题
4. **文档同步**: AI 自动更新 API 文档和代码注释

### 4.4 测试阶段

1. **测试策略**: AI 基于需求生成测试策略和测试计划
2. **用例设计**: AI 自动生成测试用例（功能、边界、异常）
3. **自动化测试**: AI 驱动自动化测试执行
4. **缺陷分析**: AI 分析缺陷根因，推荐修复方案

### 4.5 部署与运维

1. **CI/CD**: 自动化构建、测试、部署流水线
2. **监控告警**: AI 分析系统指标，预测潜在问题
3. **日志分析**: AI 聚合分析日志，快速定位故障
4. **持续优化**: AI 基于数据反馈推荐优化方案

---

## 5. AI 软件测试生命周期（AI-STLC）

### 5.1 测试类型矩阵

| 测试类型 | 工具 | AI 辅助方式 | 执行频率 |
|----------|------|-------------|----------|
| 功能测试 | pytest / Playwright | AI 生成用例 + 自动断言 | 每次提交 |
| 接口测试 | pytest + httpx | AI 生成接口用例 + 契约测试 | 每次提交 |
| Web UI 自动化 | Playwright + Midscene | AI 视觉探索 + 自动生成脚本 | 每日构建 |
| App UI 自动化 | Appium + Midscene | AI 跨平台脚本生成 | 每周回归 |
| 性能测试 | k6 / JMeter | AI 生成压测场景 + 瓶颈分析 | 发版前 |
| 安全测试 | OWASP ZAP / Burp | AI 漏洞扫描 + 修复建议 | 发版前 |
| 兼容性测试 | BrowserStack | AI 跨浏览器验证 | 发版前 |
| 回归测试 | Playwright | AI 选择回归范围 + 影响分析 | 每次合并 |
| 探索性测试 | Midscene AI Agent | AI 自主探索 + 异常发现 | 持续进行 |
| 可用性测试 | 用户测试 + AI 分析 | AI 分析用户行为 + 改进建议 | 里程碑节点 |

### 5.2 AI 测试流程

```
需求分析 → 测试策略 → 用例设计 → 环境准备 → 测试执行 → 缺陷管理 → 测试报告
   ↑                                                              ↓
   └──────────── AI 持续学习与优化 ←────────────────────────────────┘
```

### 5.3 测试质量标准

- **用例覆盖率**: 需求覆盖率 >= 95%
- **自动化率**: 核心流程 >= 80%
- **缺陷逃逸率**: < 5%
- **回归通过率**: >= 98%
- **测试执行时间**: 冒烟 < 5min，回归 < 30min

---

## 6. 项目上下文

### 6.1 技术栈

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand + TanStack Query
- **后端**: FastAPI + SQLAlchemy 2.0 + SQLite/PostgreSQL + Alembic
- **AI**: OpenAI SDK + 多引擎架构（Midscene / Playwright MCP / Browser Use / UI-TARS）
- **测试**: Playwright + pytest + Midscene.js
- **部署**: Docker + Nginx

### 6.2 目录结构

```
tts-paper-test/
├── frontend/          # React 前端 SPA
├── backend/           # FastAPI 后端 API
├── docs/              # 架构文档、PRD、设计规格
├── scripts/           # 数据库初始化等脚本
└── .qoder/            # QoderCN 配置（skills、agents）
```

### 6.3 关键约定

- API 基础路径: `/api/v1`
- 前端代理: Vite dev server 将 `/api` 代理到 `localhost:8000`
- 认证: JWT Bearer Token
- 设计风格: Polaroid 暖白色主题（`#FAF5F0` 纸张背景，`#D4A574` 琥珀金强调色）
