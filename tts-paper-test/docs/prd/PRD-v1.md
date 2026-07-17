# TSS AI测试平台 — 产品需求文档 (PRD)

> 版本: v1.0 | 日期: 2026-07-17
> 项目: tts-paper-test / TSS (Test System Service)

---

## 一、产品概述

### 1.1 产品定位
TSS AI测试平台是一个**AI驱动的全生命周期测试管理平台**，覆盖从需求分析、测试设计、测试执行到质量分析的完整流程，内置多智能体协作系统，实现测试活动的智能化、自动化。

### 1.2 产品愿景
"让测试更智能，让质量更可控" — 通过 AI Agent 赋能测试人员，降低手工测试成本，提升测试覆盖率与质量洞察深度。

### 1.3 目标用户
| 用户角色 | 核心诉求 |
|---------|---------|
| 测试工程师 | 管理测试用例、执行测试、查看报告 |
| 测试经理 | 跟踪测试进度、分析质量数据 |
| AI/ML工程师 | 配置LLM、Agent、知识库 |
| 系统管理员 | 用户管理、系统设置、MCP/Skill配置 |

---

## 二、系统架构

### 2.1 技术栈

| 层级 | 技术 | 职责 |
|------|------|------|
| **前端** | HTML + TailwindCSS + JavaScript + FontAwesome | 页面渲染、用户交互 |
| **后端** | Flask + SQLite | API服务、认证、数据持久化 |
| **AI层** | CrewAI + LangChain | 多智能体协作、测试生成/执行/分析 |
| **知识库** | ChromaDB + Sentence-Transformers | 向量存储、RAG检索 |
| **LLM** | OpenAI / Anthropic 兼容接口 | AI推理、内容生成 |

### 2.2 架构分层

```
用户浏览器 (frontend/)
    │ HTTP/WebSocket
Flask应用 (backend/app.py)
    ├── 页面路由 (frontend/routes.py → render_template)
    ├── API路由 (backend/app.py → JSON RESTful API)
    └── WebSocket → 实时推送
        │
AI Agent系统 (agents/)
    ├── 测试规划 (Planner Agent)
    ├── 测试生成 (Generator Agent)
    ├── 测试执行 (Executor Agent)
    ├── 代码评审 (Reviewer Agent)
    └── 结果分析 (Analyzer Agent)
        │
知识存储 (knowledge/) + 提示词模板 (prompts/)
    ├── Chroma向量库 (测试模式 + Bug知识)
    └── LLM提示词模板 (生成/审查/分析/报告)
```

### 2.3 数据流

```
需求输入 → AI需求分析 → 测试点提取 → 测试方案设计
    → 测试用例生成(AI) → 测试执行(手工/AI) → 结果记录
    → 质量分析(AI) → 报告输出 → 知识沉淀
```

---

## 三、功能模块详解

### 模块总览 — 4大分类 21个子模块

```
TSS AI测试平台
├── 📐 测试设计 (5模块)
│   ├── 需求分析
│   ├── 测试点管理
│   ├── 测试方案
│   ├── 测试用例
│   └── AI测试生成
├── 🚀 测试执行 (5模块)
│   ├── 执行管理
│   ├── Web自动化
│   ├── API测试
│   ├── 性能测试
│   └── AI测试执行
├── 📊 测试分析 (4模块)
│   ├── 分析报告
│   ├── 知识库
│   ├── 去AI味
│   └── AI测试分析
└── ⚙️ 系统配置 (7模块)
    ├── Agent配置
    ├── MCP服务
    ├── Skill配置
    ├── 提示词工程
    ├── 大模型配置
    ├── 用户管理
    └── 系统设置
```

---

### 3.1 测试设计 (Test Design)

#### 3.1.1 需求分析
- **功能描述**: 管理测试需求，定义测试范围和目标
- **API路由**:
  - `GET/POST /api/requirements` — 列表/创建需求
  - `PUT/DELETE /api/requirements/<id>` — 编辑/删除需求
  - `POST /api/requirements/<id>/analyze` — AI分析需求
  - `POST /api/requirements/<id>/approve` — 批准需求
- **数据字段**: id, title, content, doc_type, status(pending/analyzing/analyzed/approved), ai_analysis, test_points_count
- **AI功能**: AI自动分析需求内容，提取关键信息，生成测试建议

#### 3.1.2 测试点管理
- **功能描述**: 从需求中提取可测试的点，覆盖功能路径
- **API路由**:
  - `GET/POST /api/test-points` — 列表/创建测试点
  - `PUT/DELETE /api/test-points/<id>` — 编辑/删除
  - `POST /api/test-points/batch-delete` — 批量删除
- **数据字段**: id, requirement_id, title, description, type, priority, category, status(draft/active/covered)
- **关联**: 多对一关联到需求

#### 3.1.3 测试方案
- **功能描述**: 制定测试策略，规划测试资源和排期
- **API路由**:
  - `GET/POST /api/test-plans` — 列表/创建方案
  - `PUT/DELETE /api/test-plans/<id>` — 编辑/删除
- **数据字段**: id, title, description, status(draft/active/completed), ai_generated, ai_suggestion, requirement_ids, test_point_ids
- **关联**: 可关联需求和测试点

#### 3.1.4 测试用例
- **功能描述**: 编写标准测试用例，覆盖全场景
- **API路由**:
  - `GET/POST /api/test-cases` — 列表/创建用例
  - `PUT/DELETE /api/test-cases/<id>` — 编辑/删除
  - `POST /api/test-cases/generate` — AI生成用例
- **数据字段**: id, plan_id, test_point_id, title, precondition, steps, expected_result, actual_result, status(draft/approved/failed/passed), priority, type, ai_generated
- **AI功能**: 根据测试方案自动生成5条测试用例

#### 3.1.5 AI测试生成
- **功能描述**: 智能生成测试用例，提升效率降低成本
- **依赖**: 调用 `test-cases/generate` API + Agent系统 `TestGenerationCrew`
- **AI流程**: Planner → Generator → Reviewer 多Agent协作生成

---

### 3.2 测试执行 (Test Execution)

#### 3.2.1 执行管理
- **功能描述**: 调度测试任务，跟踪执行进度
- **API路由**:
  - `GET /api/executions` — 执行列表
  - `POST /api/executions/start` — 启动执行
  - `GET /api/executions/<id>` — 执行详情
  - `GET /api/executions/status` — 当前执行状态
- **数据字段**: id, case_ids(JSON数组), status(pending/running/completed/failed), progress(0-100%), current_phase, results(JSON)
- **特性**: 异步执行，前端轮询进度

#### 3.2.2 Web自动化
- **功能描述**: 录制回放脚本，自动化Web测试
- **API路由**:
  - `GET/POST /api/web-automation` — 列表/创建脚本
  - `PUT/DELETE /api/web-automation/<id>` — 编辑/删除
- **数据字段**: id, name, description, target_url, steps(JSON), status(draft/active), last_run, last_result

#### 3.2.3 API测试
- **功能描述**: 验证接口功能，保障服务稳定性
- **前端**: 独立的 UI 页面
- **后端**: 通过 Agent 系统的 `api_client.py` 工具支持

#### 3.2.4 性能测试
- **功能描述**: 压测系统性能，发现瓶颈
- **前端**: 独立的 UI 页面
- **后端**: 预留接口，待扩展

#### 3.2.5 AI测试执行
- **功能描述**: AI驱动执行，智能分析结果
- **依赖**: Agent系统 `TestExecutionCrew`
- **AI流程**: Executor Agent 执行 pytest → 解析结果 → 重试不稳定测试 → 生成报告

---

### 3.3 测试分析 (Test Analysis)

#### 3.3.1 分析报告
- **功能描述**: 生成质量报告，数据可视化
- **API路由**:
  - `GET /api/reports` — 报告列表
  - `POST /api/reports` — 生成报告
  - `PUT/DELETE /api/reports/<id>` — 编辑/删除
- **数据字段**: id, title, type, content, summary, generated_by, generated_at
- **AI功能**: 通过 Agent 工具 `report_generator.py` 生成

#### 3.3.2 知识库
- **功能描述**: 沉淀测试知识，复用经验
- **两个子模块**:
  - **测试模式 (Patterns)**:
    - `GET/POST /api/knowledge/patterns`
    - `PUT/DELETE /api/knowledge/patterns/<id>`
    - 字段: title, category, content, tags, embedding_id
    - 支持向量检索 (RAG)
  - **Bug知识 (Bugs)**:
    - `GET/POST /api/knowledge/bugs`
    - `PUT/DELETE /api/knowledge/bugs/<id>`
    - 字段: bug_id, title, description, severity, root_cause, solution, embedding_id
- **存储**: ChromaDB 向量数据库 + SQLite 元数据

#### 3.3.3 去AI味
- **功能描述**: 优化AI生成内容，使其更自然流畅，消除"AI痕迹"
- **API路由**:
  - `GET/POST /api/de-ai/strategies` — 列表/创建策略
  - `PUT/DELETE /api/de-ai/strategies/<id>` — 编辑/删除
  - `POST /api/de-ai/strategies/<id>/test` — 测试策略效果
- **数据字段**: id, name, type(style/terminology/format/custom), config(JSON), enabled

#### 3.3.4 AI测试分析
- **功能描述**: 深度分析测试数据，洞察质量趋势
- **依赖**: Agent系统 `AnalysisCrew`
- **AI流程**: Analyzer Agent → 识别模式/问题 → 生成建议 → 更新知识库

---

### 3.4 系统配置 (System Config)

#### 3.4.1 Agent配置
- **功能描述**: 配置AI代理（名称、角色、目标、背景故事、工具集）
- **API路由**: `GET/POST/PUT/DELETE /api/agents`
- **数据字段**: id, name, role, goal, backstory, tools(JSON), config(JSON), status(active/inactive)
- **系统集成**: 与 CrewAI Agent 定义对应

#### 3.4.2 MCP服务
- **功能描述**: 管理模型上下文协议（Model Context Protocol）服务
- **API路由**: `GET/POST/PUT/DELETE /api/mcp-services`
- **额外路由**: `POST /api/mcp-services/<id>/test` — 测试连接
- **数据字段**: id, name, type, endpoint, config(JSON), status(active/inactive)
- **特性**: 端到端连接测试，记录响应时间

#### 3.4.3 Skill配置
- **功能描述**: 配置AI技能（提示词模板 + 配置）
- **API路由**: `GET/POST/PUT/DELETE /api/skills`
- **数据字段**: id, name, description, prompt_template, config(JSON), status(active/inactive), version

#### 3.4.4 提示词工程
- **功能描述**: 设计和管理 LLM 提示词模板
- **API路由**: `GET/POST/PUT/DELETE /api/prompts`
- **数据字段**: id, name, category, template, variables(JSON), version
- **用途**: 为 AI Agent 提供高质量的提示词

#### 3.4.5 大模型配置
- **功能描述**: 管理 LLM 提供商和模型（OpenAI、Anthropic等）
- **API路由**: `GET/POST/PUT/DELETE /api/llm/providers`
- **数据字段**: id, name, type(openai/anthropic/custom), api_key, base_url, config(JSON), status(active/inactive)

#### 3.4.6 用户管理
- **功能描述**: 管理系统用户和权限
- **API路由**: `GET/POST/PUT/DELETE /api/users`
- **前端路由**: `/users` 页面
- **数据字段**: id, username, email, password_hash, role(admin/user), status(active/inactive), created_at
- **安全**: 密码 bcrypt 加密，不能删除自己

#### 3.4.7 系统设置
- **功能描述**: 配置系统参数和偏好
- **前端**: 独立的 `/settings` 页面
- **后端**: 预留接口

---

## 四、全局功能

### 4.1 认证与安全
| 功能 | 说明 |
|------|------|
| 登录 | 用户名+密码+验证码（数学验证码） |
| 记住我 | Cookie 记住登录状态 |
| Session管理 | Flask session + 登录态校验 |
| 图形验证码 | SVG/PNG 验证码，支持刷新 |
| 退出登录 | 清除 session，重定向到登录页 |
| CSRF保护 | Token 生成与验证 |
| 输入验证 | XSS 过滤、SQL注入防护 |
| 速率限制 | 基于内存的请求限流 |

### 4.2 导航与布局
| 功能 | 说明 |
|------|------|
| 首页仪表盘 | 分类TAB切换 + 功能大卡片网格 |
| 子侧边栏 | 当前分类下的有序子菜单，步骤状态指示 |
| 工作流指示器 | 水平进度条显示完成/当前/未来步骤 |
| 步进导航 | "上一步/下一步" 按钮，边界项自动隐藏 |
| 面包屑 | 首页 > 分类 > 当前页面 |
| 响应式布局 | 适配移动端 (max-width: 480px) |

### 4.3 数据操作
| 功能 | 说明 |
|------|------|
| CRUD | 所有模块支持增删改查 |
| 批量操作 | 测试点支持批量删除 |
| 分页 | API 返回列表数据 |
| 排序 | 按创建时间排序 |
| 状态管理 | 各模块有独立的生命周期状态 |

### 4.4 AI 智能功能
| 功能 | 说明 |
|------|------|
| AI需求分析 | 自动分析需求内容 |
| AI测试生成 | 多Agent协作生成测试用例 |
| AI测试执行 | 自动化执行 + 结果解析 + 重试 |
| AI测试分析 | 识别质量问题 + 生成建议 |
| 去AI味 | 多种策略消除AI生成痕迹 |
| RAG知识检索 | 基于向量库的相似模式/Bug检索 |

---

## 五、数据库模型

| 表名 | 记录数 | 用途 |
|------|--------|------|
| users | 用户 | 认证与角色管理 |
| requirements | 需求 | 测试需求文档 |
| test_points | 测试点 | 可测试的功能点 |
| test_plans | 测试方案 | 测试计划 |
| test_cases | 测试用例 | 详细测试用例 |
| test_executions | 执行记录 | 执行历史与结果 |
| agents | AI代理 | Agent元数据 |
| mcp_services | MCP服务 | 外部服务注册 |
| skills | AI技能 | 提示词技能 |
| prompt_templates | 提示词模板 | LLM提示词管理 |
| llm_providers | LLM提供商 | 模型配置 |
| knowledge_patterns | 测试模式 | RAG知识(模式) |
| knowledge_bugs | Bug知识 | RAG知识(Bug) |
| de_ai_strategies | 去AI味策略 | 内容优化策略 |
| web_scripts | Web脚本 | 自动化脚本存储 |

---

## 六、非功能需求

| 需求 | 指标 |
|------|------|
| 响应时间 | 页面 < 500ms, API < 200ms |
| 并发 | 支持 50+ 并发用户 |
| 数据持久化 | SQLite 本地存储 |
| 安全性 | 密码加密、CSRF保护、输入验证 |
| 可扩展性 | 模块化设计，新模块可插拔 |
| AI集成 | 支持 OpenAI / Anthropic 切换 |
