# TSS AI测试平台 — 架构设计方案 (v2.0)

> 基于PRD v1.0 + 模块清单 重构设计
> 版本: v2.0 | 日期: 2026-07-17
> 设计范围: Phase 1 基础模块（测试基础 + 基础配置 + 个人中心）

---

## 一、设计理念

### 1.1 核心理念
- **AI驱动，Human-in-the-Loop**: 所有AI生成内容必须经过人工审核确认后才入库
- **多智能体协作**: CrewAI编排多个专业Agent协同工作
- **可观测性优先**: 三层日志体系确保全链路可追踪
- **模块化可扩展**: 当前基础模块完成后可平滑扩展具体测试类型

### 1.2 产品愿景
"让测试更智能，让质量更可控" — AI Agent赋能测试全生命周期

---

## 二、技术栈选型（2026年最新）

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| **前端** | Vue 3 + TypeScript + Vite | Vue 3.5+, Vite 6+ | 组件生态成熟、性能优异、shadcn-vue原生暗黑模式 |
| **UI组件** | shadcn-vue + Tailwind CSS | Latest | 现代化组件库、可定制主题、无障碍支持 |
| **状态管理** | Pinia | Latest | Vue官方状态管理、TypeScript友好 |
| **图表** | ECharts + vue-echarts | Latest | 测试报告可视化、大数据量渲染 |
| **编辑器** | Monaco Editor | Latest | 提示词/脚本编辑、代码高亮 |
| **后端** | FastAPI + Python 3.12+ | FastAPI 0.115+ | 异步高性能、自动OpenAPI文档、Pydantic v2 |
| **ORM** | SQLAlchemy 2.0 (async) | 2.0+ | 异步支持、类型安全、成熟稳定 |
| **数据库** | PostgreSQL 17 + pgvector | 17+ | ACID事务、向量搜索一体化、避免额外中间件 |
| **迁移** | Alembic | Latest | SQLAlchemy官方迁移工具 |
| **认证** | JWT + OAuth2 | — | 无状态认证、安全可靠 |
| **AI编排** | CrewAI 1.15+ | Latest | 多智能体协作、MCP协议支持、实时追踪 |
| **AI框架** | LangChain + LangSmith | Latest | LLM调用抽象、可观测性 |
| **LLM** | OpenAI / Anthropic / 自定义 | Latest | 多提供商切换、模型灵活配置 |
| **异步任务** | Celery / ARQ | Latest | 异步执行测试任务 |
| **实时通信** | WebSocket (FastAPI) | — | 执行进度实时推送 |
| **日志** | structlog + loguru | Latest | 结构化日志、JSON输出、多Handler |

---

## 三、模块架构（Phase 1）

```
TSS AI测试平台 v2.0 (Phase 1)
├── 📐 测试基础 (7模块) ← 软件测试全生命周期
│   ├── 需求分析管理
│   ├── 测试点管理  
│   ├── 测试方案管理
│   ├── 测试用例管理
│   ├── 执行管理
│   ├── 缺陷管理
│   └── 测试报告
├── ⚙️ 基础配置 (7模块) ← 平台基础支撑
│   ├── 环境配置
│   ├── 大模型配置
│   ├── 提示词配置
│   ├── 去AI味配置
│   ├── MCP服务配置
│   ├── Skills技能配置
│   └── Hermes配置
└── 👤 个人中心 (3模块) ← 用户与权限
    ├── 用户管理
    ├── 角色管理  
    └── 个人资料
```

---

## 四、数据库设计

### 4.1 数据库选型
- **主库**: PostgreSQL 17 + pgvector 扩展
- **向量支持**: pgvector (HNSW索引) 替代 ChromaDB
- **连接池**: asyncpg + SQLAlchemy async engine

### 4.2 表结构设计

```sql
-- ========== 测试基础模块 ==========

-- 需求分析表
CREATE TABLE requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    doc_type VARCHAR(50) DEFAULT 'text',  -- text/markdown/docx
    status VARCHAR(20) DEFAULT 'pending',  -- pending/analyzing/analyzed/approved/rejected
    ai_analysis JSONB,                     -- AI分析结果（草稿）
    human_review TEXT,                     -- 人工审核意见
    version INT DEFAULT 1,
    test_points_count INT DEFAULT 0,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 测试点表
CREATE TABLE test_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'functional',  -- functional/ui/api/performance/security
    priority VARCHAR(20) DEFAULT 'medium',  -- critical/high/medium/low
    category VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft',      -- draft/active/covered/obsolete
    ai_generated BOOLEAN DEFAULT FALSE,
    source VARCHAR(20) DEFAULT 'manual',     -- manual/ai_extracted
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 测试方案表
CREATE TABLE test_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',     -- draft/active/completed/archived
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_suggestion JSONB,                    -- AI建议内容（草稿）
    requirement_ids UUID[],
    test_point_ids UUID[],
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 测试用例表
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    test_point_id UUID REFERENCES test_points(id) ON DELETE SET NULL,
    title VARCHAR(300) NOT NULL,
    precondition TEXT,
    steps JSONB NOT NULL,                    -- [{step: 1, action: "..."}, ...]
    expected_result TEXT NOT NULL,
    actual_result TEXT,
    status VARCHAR(20) DEFAULT 'draft',      -- draft/approved/failed/passed/blocked
    priority VARCHAR(20) DEFAULT 'medium',
    type VARCHAR(50) DEFAULT 'functional',
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_generation_id UUID,                   -- AI生成批次ID
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 执行记录表
CREATE TABLE test_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES test_plans(id),
    case_ids UUID[],
    status VARCHAR(20) DEFAULT 'pending',    -- pending/running/completed/failed/aborted
    progress INT DEFAULT 0,                  -- 0-100
    current_phase VARCHAR(100),
    results JSONB,                           -- 执行结果详情
    started_by UUID REFERENCES users(id),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 缺陷表
CREATE TABLE defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'major',    -- critical/major/minor/trivial
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'new',        -- new/confirmed/in_progress/resolved/closed
    root_cause TEXT,
    solution TEXT,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    execution_id UUID REFERENCES test_executions(id) ON DELETE SET NULL,
    ai_analysis JSONB,                       -- AI分析结果（草稿）
    assigned_to UUID REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 测试报告表
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    type VARCHAR(50) DEFAULT 'test_summary', -- test_summary/quality/metrics
    content JSONB,                            -- 报告内容
    summary TEXT,
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_draft JSONB,                           -- AI生成草稿
    status VARCHAR(20) DEFAULT 'draft',       -- draft/published/archived
    generated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========== 基础配置模块 ==========

-- 环境配置表
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'testing',      -- development/testing/staging/production
    config JSONB NOT NULL,                    -- 环境变量配置
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 大模型提供商表
CREATE TABLE llm_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,                -- openai/anthropic/custom/local
    api_key_encrypted TEXT NOT NULL,          -- 加密存储
    base_url VARCHAR(500),
    models JSONB,                             -- 可用模型列表
    config JSONB,                             -- 默认参数（temperature等）
    status VARCHAR(20) DEFAULT 'active',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 提示词模板表
CREATE TABLE prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),                    -- requirement/testcase/report/review
    template TEXT NOT NULL,
    variables JSONB,                          -- 变量定义
    version INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 去AI味策略表
CREATE TABLE de_ai_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,               -- style/terminology/format/custom
    config JSONB NOT NULL,                    -- 策略配置
    enabled BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- MCP服务配置表
CREATE TABLE mcp_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,               -- stdio/sse/streamable-http
    endpoint VARCHAR(500),
    command VARCHAR(500),                     -- stdio模式命令
    args JSONB,                               -- 启动参数
    config JSONB,
    status VARCHAR(20) DEFAULT 'inactive',    -- active/inactive/error
    last_connected_at TIMESTAMP,
    response_time_ms INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Skills技能表
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    prompt_template TEXT,
    config JSONB,
    version INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    source VARCHAR(50) DEFAULT 'custom',       -- custom/market/imported
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Hermes配置表
CREATE TABLE hermes_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL,            -- telegram/discord/slack/wecom/feishu
    config JSONB NOT NULL,                    -- 平台连接配置
    webhook_url VARCHAR(500),
    enabled BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'disconnected',
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ========== 个人中心模块 ==========

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(200),
    avatar_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'user',          -- admin/test_manager/test_engineer/viewer
    status VARCHAR(20) DEFAULT 'active',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 角色表
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL,               -- 权限列表
    is_system BOOLEAN DEFAULT FALSE,          -- 系统角色不可删除
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 用户-角色关联表
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- API Token表
CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    token_hash TEXT NOT NULL,
    permissions JSONB,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========== 审计日志表 ==========

CREATE TABLE operation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    username VARCHAR(100),
    action VARCHAR(50) NOT NULL,              -- create/update/delete/approve/review/ai_generate
    resource_type VARCHAR(50) NOT NULL,       -- requirement/test_point/test_case/defect...
    resource_id UUID,
    details JSONB,                            -- 操作详情
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_operation_logs_user ON operation_logs(user_id);
CREATE INDEX idx_operation_logs_action ON operation_logs(action);
CREATE INDEX idx_operation_logs_resource ON operation_logs(resource_type, resource_id);
CREATE INDEX idx_operation_logs_created ON operation_logs(created_at DESC);

-- ========== AI相关表 ==========

-- AI生成记录表（用于追踪每次AI生成和审批）
CREATE TABLE ai_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type VARCHAR(50) NOT NULL,          -- requirement_analyzer/test_case_generator/...
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    input_data JSONB,                         -- 输入数据
    output_data JSONB,                        -- AI输出草稿
    status VARCHAR(20) DEFAULT 'draft',       -- draft/reviewed/confirmed/rejected
    reviewed_by UUID REFERENCES users(id),
    review_comment TEXT,
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMP,
    model_used VARCHAR(200),
    token_usage JSONB,
    latency_ms INT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 五、AI多智能体系统设计

### 5.1 智能体架构

```
CrewAI Multi-Agent System
├── RequirementAnalysisCrew
│   ├── Agent: RequirementAnalyzer
│   │   - Role: 需求分析师
│   │   - Tools: read_document, search_knowledge, extract_keypoints
│   │   - Output: 需求分析报告（草稿）
│   └── 工作流: 读取需求 → 分析关键信息 → 生成测试建议 → 人工审核
│
├── TestPointCrew
│   ├── Agent: TestPointExtractor
│   │   - Role: 测试点提取专家
│   │   - Tools: analyze_requirement, identify_paths, categorize_points
│   │   - Output: 测试点列表（草稿）
│   └── 工作流: 读取需求 → 多角度分析 → 提取测试点 → 人工增删改
│
├── TestCaseGenerationCrew
│   ├── Agent: TestPlanner (规划者)
│   │   - Role: 测试场景规划师
│   │   - Tools: analyze_plan, design_scenarios, coverage_check
│   ├── Agent: TestGenerator (生成者)
│   │   - Role: 测试用例编写专家
│   │   - Tools: write_testcase, format_steps, generate_expected
│   ├── Agent: TestReviewer (评审者)
│   │   - Role: 测试用例评审专家
│   │   - Tools: review_coverage, check_quality, suggest_improvements
│   └── 工作流: Planner规划 → Generator生成 → Reviewer评审 → 人工逐条审核
│
├── DefectAnalysisCrew
│   ├── Agent: DefectAnalyzer
│   │   - Role: 缺陷分析专家
│   │   - Tools: analyze_bug, classify_severity, suggest_root_cause
│   │   - Output: 缺陷分析报告（草稿）
│   └── 工作流: 读取缺陷 → 分析根因 → 推荐解决方案 → 人工确认
│
└── ReportGenerationCrew
    ├── Agent: ReportGenerator
    │   - Role: 测试报告撰写专家
    │   - Tools: collect_metrics, generate_charts, write_summary
    │   - Output: 测试报告（草稿）
    └── 工作流: 汇总数据 → 生成报告 → 人工调整 → 确认发布
```

### 5.2 Human-in-the-Loop 流程

```
AI生成 → 状态: draft(草稿) → 前端展示 → 人工审核编辑
    ├── 审核通过 → 确认(confirmed) → 正式入库
    ├── 审核驳回 → 状态: rejected → 标注驳回原因
    └── 需要修改 → 人工编辑保存 → 重新提交审核 → 确认

每个环节:
- AI生成记录完整保存在 ai_generations 表
- 每次人工修改都有 diff 对比
- 前端清晰标注 "AI生成草稿" / "人工已编辑" / "已确认"
- 操作日志记录每个状态的变更
```

### 5.3 AI 执行流程示例（测试用例生成）

```
用户点击"AI生成用例"
  ↓
POST /api/test-cases/ai-generate
  ↓
后端创建 ai_generation 记录 (status=draft)
  ↓
异步调用 TestCaseGenerationCrew
  ├── Planner Agent: "分析测试方案，规划覆盖场景"
  │   → 输出场景列表
  ├── Generator Agent: "为每个场景编写标准测试用例"
  │   → 输出5-10条用例（前置条件、步骤、预期）
  └── Reviewer Agent: "评审用例质量、检查遗漏"
      → 输出评审意见和改进建议
  ↓
结果存入 ai_generations.output_data
  ↓
WebSocket 通知前端生成完成
  ↓
前端展示AI生成的用例草稿（带"AI生成"标签）
  → 用户逐条编辑/删除/新增
  → 点击"确认入库" → status=confirmed → 写入 test_cases 表
  → 记录操作日志
```

---

## 六、UI/UX设计规范

### 6.1 设计语言
- **风格**: "精准·专业·科技感" — 测试工具美学
- **暗黑模式**: 为主色调，适配测试人员长时间使用
- **双主色体系**: 测试绿 #00C853 + 质检蓝 #2196F3

### 6.2 色彩系统
```
背景层级:
  bg-base:     #0a0e17  (最深)
  bg-surface:  #141a2b  (表面)
  bg-elevated: #1c2538  (抬起/卡片)
  bg-hover:    #243050  (悬停)

文本层级:
  text-primary:   #e8edf5
  text-secondary: #8b95a8
  text-muted:     #5a6478

语义色:
  success: #00C853  (测试绿)
  warning: #FF6D00  (警告橙)
  error:   #FF1744  (错误红)
  info:    #2196F3  (信息蓝)

边框色:
  border: #2a3550
  border-light: #3a4560
```

### 6.3 组件风格
- **卡片**: 圆角12px，背景 bg-elevated，微光边框 1px solid border
- **按钮**: 圆角8px，主色渐变，悬停微亮效果
- **表格**: 条纹行（奇偶不同色），悬停高亮，固定表头
- **状态标签**: 圆点+文字组合（● 通过 / ● 失败 / ● 待审核）
- **步骤进度条**: 水平流程指示，完成/当前/未来三态
- **编辑器**: Monaco Editor 深色主题
- **图表**: ECharts 暗黑主题

### 6.4 布局结构
```
┌──────────────────────────────────────────────────────┐
│  🚀 TSS AI测试平台          [搜索] [通知] [头像▼]   │ ← 顶栏
├──────────┬───────────────────────────────────────────┤
│          │  首页 > 测试基础 > 需求分析               │ ← 面包屑
│  📐 测试 │                                          │
│    基础  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐               │
│  ├ 需求  │  │ 需 │ │ 测 │ │ 测 │ │ 测 │              │
│  ├ 测试点│  │ 求 │ │ 试 │ │ 试 │ │ 试用│             │ ← 步骤
│  ├ 方案  │  │ 分 │ │ 点 │ │ 方 │ │ 例 │              │    导航
│  ├ 用例  │  └───┘ └───┘ └───┘ └───┘               │
│  ├ 执行  │                                          │
│  ├ 缺陷  │  ┌──────────────────────────────────┐    │
│  └ 报告  │  │ 内容区域                          │    │
│          │  │                                    │    │
│  ⚙️ 基础 │  │                                    │    │
│     配置 │  └──────────────────────────────────┘    │
│  👤 个人 │                                          │
│     中心 │                                          │
├──────────┴───────────────────────────────────────────┤
│  MCP: ●在线 Skill: ●在线 AI: ●就绪  2026-07-17     │ ← 底栏
└──────────────────────────────────────────────────────┘
```

---

## 七、日志系统设计（三层追踪）

### 7.1 第一层：前端操作日志
- **实现**: Vue Router 导航守卫 + Axios 拦截器 + 主动上报
- **记录内容**: 
  - 页面访问（PV/UV）
  - 用户操作（增删改查、审核、确认）
  - AI交互（生成请求、生成完成、确认/驳回）
- **存储**: 后端 `operation_logs` 表
- **查询**: 前端"操作日志"页面支持多维筛选

### 7.2 第二层：后端终端实时日志
- **实现**: structlog + Rich 终端格式化
- **输出格式**: JSON + 彩色终端

```python
# 终端输出示例
2026-07-17 14:30:22 [INFO]    api.v1.test_cases ═══════════════════════════════
2026-07-17 14:30:22 [INFO]    api.v1.test_cases 🚀 AI生成测试用例请求
2026-07-17 14:30:22 [INFO]    api.v1.test_cases     ├ Plan ID: abc-123
2026-07-17 14:30:22 [INFO]    api.v1.test_cases     └ 需求数: 3 | 测试点数: 12
2026-07-17 14:30:23 [INFO]    agents.test_case_crew ╔═══ CrewAI 开始执行 ═══╗
2026-07-17 14:30:23 [INFO]    agents.test_case_crew ┃ Agent: TestPlanner
2026-07-17 14:30:23 [INFO]    agents.test_case_crew ┃   → 分析测试方案...
2026-07-17 14:30:25 [INFO]    agents.test_case_crew ┃   → 规划完成: 5个场景
2026-07-17 14:30:25 [INFO]    agents.test_case_crew ┃ Agent: TestGenerator
2026-07-17 14:30:25 [INFO]    agents.test_case_crew ┃   → 生成测试用例...
2026-07-17 14:30:30 [INFO]    agents.test_case_crew ┃   → 生成完成: 8条用例
2026-07-17 14:30:30 [INFO]    agents.test_case_crew ┃ Agent: TestReviewer
2026-07-17 14:30:30 [INFO]    agents.test_case_crew ┃   → 评审用例...
2026-07-17 14:30:32 [INFO]    agents.test_case_crew ┃   → 评审完成: 1条需改进
2026-07-17 14:30:32 [INFO]    agents.test_case_crew ╚══════ 执行完毕 ══════╝
2026-07-17 14:30:32 [INFO]    api.v1.test_cases ✅ AI生成完成，8条用例待审核
```

### 7.3 第三层：文件日志存储
```
logs/
├── app/                    # 应用运行日志
│   └── 2026/
│       └── 07/
│           └── 17/
│               ├── app.log          # 应用主日志
│               └── error.log        # 错误日志（单独抽取）
├── ai/                     # AI Agent执行日志
│   └── 2026/07/17/
│       ├── requirement_crew.log
│       ├── test_case_crew.log
│       ├── defect_crew.log
│       └── report_crew.log
├── api/                    # API请求日志
│   └── 2026/07/17/
│       └── api.log
├── auth/                   # 认证安全日志
│   └── 2026/07/17/
│       └── auth.log
├── operation/              # 用户操作日志（DB同步+文件双写）
│   └── 2026/07/
│       └── operation.log
└── audit/                  # 审计日志（不可篡改）
    └── 2026/07/17/
        └── audit.log
```

### 7.4 日志配置架构
```python
# logging_config.py
LOGGING_CONFIG = {
    "version": 1,
    "formatters": {
        "json": {"format": "%(asctime)s %(level)s %(name)s %(message)s"},
        "console": {"format": "%(asctime)s [%(level)s] %(name)s %(message)s"}
    },
    "handlers": {
        "console": {           # 终端输出（带颜色）
            "class": "rich.logging.RichHandler",
            "level": "INFO"
        },
        "app_file": {          # 应用日志文件
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": "logs/app/app.log",
            "when": "midnight",
            "backupCount": 90
        },
        "ai_file": {           # AI日志文件
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/ai/ai.log",
            "maxBytes": 104857600  # 100MB
        }
    },
    "loggers": {
        "app": {"handlers": ["console", "app_file"], "level": "INFO"},
        "agents": {"handlers": ["console", "ai_file"], "level": "DEBUG"},
        "api": {"handlers": ["app_file"], "level": "INFO"}
    }
}
```

---

## 八、项目目录结构

```
TSS-System/
├── frontend/                          # 前端工程
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                # AdminLayout, Sidebar, Header, Footer
│   │   │   ├── common/                # StatusBadge, StepProgress, AIPanel
│   │   │   └── ai/                    # AIGenerationPanel, ReviewDialog, DiffViewer
│   │   ├── views/
│   │   │   ├── dashboard/             # 首页仪表盘
│   │   │   ├── test-foundation/       # 7个测试基础子模块
│   │   │   ├── config/                # 7个基础配置子模块
│   │   │   └── personal/              # 个人中心页面
│   │   ├── stores/                    # Pinia stores
│   │   ├── api/                       # API请求封装
│   │   ├── router/                    # 路由配置
│   │   ├── composables/               # useAuth, useLog, useAI
│   │   ├── styles/                    # 全局样式 + 主题变量
│   │   └── types/                     # TypeScript类型
│   └── ...配置
│
├── backend/                           # 后端工程
│   ├── app/
│   │   ├── api/v1/                    # API路由
│   │   │   ├── test_foundation/       # requirements, test_points, test_plans, test_cases, executions, defects, reports
│   │   │   ├── config/                # environments, llm_providers, prompts, de_ai, mcp, skills, hermes
│   │   │   └── personal/             # users, roles, profile, tokens
│   │   ├── core/                      # config, security, database, logging
│   │   ├── models/                    # SQLAlchemy models
│   │   ├── schemas/                   # Pydantic schemas
│   │   ├── services/                  # Business logic
│   │   ├── agents/                    # AI Agent集成接口
│   │   └── utils/                     # Tool functions
│   ├── logs/                          # 日志目录（自动生成）
│   ├── alembic/                       # 数据库迁移
│   └── requirements.txt
│
├── agents/                            # AI多智能体系统
│   ├── crews/                         # CrewAI crews
│   │   ├── requirement_crew.py
│   │   ├── test_point_crew.py
│   │   ├── test_case_crew.py
│   │   ├── defect_crew.py
│   │   └── report_crew.py
│   ├── tools/                         # 自定义工具
│   │   ├── database_tools.py
│   │   ├── knowledge_tools.py
│   │   └── execution_tools.py
│   └── config/                        # Agent角色定义
│       ├── agents.yaml
│       └── tasks.yaml
│
├── knowledge/                         # 知识库
│   ├── patterns/                      # 测试模式
│   ├── bugs/                          # Bug知识
│   └── embeddings/                    # 向量索引
│
├── docs/                              # 项目文档
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DEPLOY.md
│
└── scripts/                           # 部署脚本
    ├── setup.sh
    ├── migrate.sh
    └── start.sh
```

---

## 九、API设计概览

### 9.1 测试基础 API

| Method | Endpoint | 描述 | AI介入 |
|--------|----------|------|--------|
| GET/POST | `/api/v1/requirements` | 需求列表/创建 | - |
| PUT/DELETE | `/api/v1/requirements/{id}` | 编辑/删除需求 | - |
| POST | `/api/v1/requirements/{id}/analyze` | AI分析需求 | ✅ |
| POST | `/api/v1/requirements/{id}/approve` | 审批需求 | - |
| GET/POST | `/api/v1/test-points` | 测试点列表/创建 | - |
| PUT/DELETE | `/api/v1/test-points/{id}` | 编辑/删除测试点 | - |
| POST | `/api/v1/test-points/batch-delete` | 批量删除 | - |
| POST | `/api/v1/test-points/ai-extract` | AI提取测试点 | ✅ |
| GET/POST | `/api/v1/test-plans` | 方案列表/创建 | - |
| PUT/DELETE | `/api/v1/test-plans/{id}` | 编辑/删除方案 | - |
| POST | `/api/v1/test-plans/{id}/ai-suggest` | AI方案建议 | ✅ |
| GET/POST | `/api/v1/test-cases` | 用例列表/创建 | - |
| PUT/DELETE | `/api/v1/test-cases/{id}` | 编辑/删除用例 | - |
| POST | `/api/v1/test-cases/ai-generate` | AI生成用例 | ✅ |
| POST | `/api/v1/test-cases/{id}/confirm` | 确认入库 | - |
| POST | `/api/v1/executions/start` | 启动执行 | - |
| GET | `/api/v1/executions/{id}` | 执行详情 | - |
| WS | `/api/v1/executions/{id}/progress` | 执行进度推送 | - |
| GET/POST | `/api/v1/defects` | 缺陷列表/创建 | - |
| PUT/DELETE | `/api/v1/defects/{id}` | 编辑/删除缺陷 | - |
| POST | `/api/v1/defects/{id}/analyze` | AI分析缺陷 | ✅ |
| GET/POST | `/api/v1/reports` | 报告列表/创建 | - |
| POST | `/api/v1/reports/ai-generate` | AI生成报告 | ✅ |

### 9.2 基础配置 API
| Method | Endpoint | 描述 |
|--------|----------|------|
| CRUD | `/api/v1/environments` | 环境配置管理 |
| CRUD | `/api/v1/llm/providers` | 大模型提供商管理 |
| POST | `/api/v1/llm/providers/{id}/test` | 测试LLM连接 |
| CRUD | `/api/v1/prompts` | 提示词模板管理 |
| CRUD | `/api/v1/de-ai/strategies` | 去AI味策略管理 |
| POST | `/api/v1/de-ai/strategies/{id}/test` | 测试策略效果 |
| CRUD | `/api/v1/mcp/services` | MCP服务管理 |
| POST | `/api/v1/mcp/services/{id}/test` | 测试MCP连接 |
| CRUD | `/api/v1/skills` | Skills技能管理 |
| CRUD | `/api/v1/hermes/config` | Hermes配置管理 |

### 9.3 个人中心 API
| Method | Endpoint | 描述 |
|--------|----------|------|
| CRUD | `/api/v1/users` | 用户管理 |
| CRUD | `/api/v1/roles` | 角色管理 |
| GET/PUT | `/api/v1/profile` | 个人资料 |
| CRUD | `/api/v1/profile/tokens` | API Token管理 |
| GET | `/api/v1/operation-logs` | 操作日志查询 |

---

## 十、实施路线图

### Phase 1: 项目骨架搭建（第1-2周）
- [ ] 初始化前端工程（Vue 3 + Vite + shadcn-vue + Tailwind）
- [ ] 初始化后端工程（FastAPI + SQLAlchemy + PostgreSQL）
- [ ] 认证系统（登录/注册/JWT/验证码/CSRF/速率限制）
- [ ] 基础布局（侧边栏/顶栏/面包屑/Dashboard首页）
- [ ] 三层日志系统搭建
- [ ] 数据库设计与Alembic初始化迁移
- [ ] 基础CI/CD脚本

### Phase 2: 测试基础模块（第3-6周）
- [ ] 需求分析管理（CRUD + AI分析 + 审批流）
- [ ] 测试点管理（CRUD + 批量操作 + AI提取）
- [ ] 测试方案管理（CRUD + AI建议）
- [ ] 测试用例管理（CRUD + AI生成 + 人工审核确认机制）
- [ ] 执行管理（调度 + WebSocket进度推送）
- [ ] 缺陷管理（CRUD + AI分析）
- [ ] 测试报告（AI生成 + ECharts可视化）

### Phase 3: 基础配置模块（第7-9周）
- [ ] 环境配置管理
- [ ] 大模型配置（多提供商 + 加密API Key + 模型切换）
- [ ] 提示词配置（模板/变量/版本/预览）
- [ ] 去AI味配置（多策略 + 效果测试）
- [ ] MCP服务配置（连接管理 + 状态监控）
- [ ] Skills技能配置（CRUD + 版本 + 导入导出）
- [ ] Hermes配置（多平台消息网关）

### Phase 4: 个人中心 + 完善（第10-11周）
- [ ] 用户管理（CRUD + 启用/禁用）
- [ ] 角色管理（RBAC + 权限与菜单联动）
- [ ] 个人资料（设置 + API Token管理）
- [ ] 操作日志查询页面
- [ ] 系统全局设置

### Phase 5: 多智能体深度集成（第12-14周）
- [ ] CrewAI Crews完整实现与优化
- [ ] 智能体协作流程调优
- [ ] LangSmith可观测性集成
- [ ] 知识库RAG增强（pgvector语义搜索）
- [ ] 性能优化 + 压力测试
- [ ] 文档完善 + 部署手册

---

## 十一、风险与应对

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| AI生成质量不稳定 | 中 | 高 | Human-in-the-Loop机制兜底，提示词迭代优化 |
| LLM接口延迟 | 中 | 中 | 异步处理 + WebSocket推送进度 + 超时重试 |
| 多智能体协调复杂度 | 高 | 中 | 先实现单Agent再扩展多Agent协作 |
| 前端暗黑模式可访问性 | 低 | 低 | 遵循WCAG标准，提供充足对比度 |
| pgvector性能瓶颈 | 中 | 低 | HNSW索引优化，监控查询性能 |
| 数据安全（API Key） | 高 | 低 | 加密存储 + 访问控制 + 审计日志 |

---

## 十二、后续规划（Phase 2+）

当前Phase 1完成后，后续版本将引入具体测试类型：
1. **功能测试增强** — AI驱动的功能测试自动化
2. **接口测试** — 基于Agent的接口自动化测试（REST/GraphQL/gRPC）
3. **Web自动化测试** — AI元素定位 + Playwright/Selenium集成
4. **性能测试** — AI压测场景生成 + 结果分析
5. **安全测试** — AI安全扫描 + 漏洞分析
6. **APP自动化测试** — 移动端测试集成
7. **持续集成** — CI/CD流水线集成
