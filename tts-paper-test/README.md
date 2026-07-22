# TSS AI测试平台

> 基于AI驱动的智能软件测试平台，集成需求分析、用例生成、自动化执行、缺陷管理全流程

## 项目简介

TSS（Test System Service）是一个AI驱动的软件测试平台，覆盖软件测试全生命周期。平台通过AI Agent自动探索网页、生成测试用例、执行测试并分析缺陷，大幅提升测试效率。

### 核心特性

- **AI全流程Pipeline** — 从需求文档到测试报告的端到端自动化
- **AI Web自动化** — 多引擎支持：Midscene.js / Playwright MCP / Browser Use / UI-TARS
- **AI智能体面板** — 自然语言描述测试意图，AI自动规划并执行全流程
- **测试技能库** — 选择器/断言/场景模板，可复用的测试技能资产
- **智能Agent工作流** — 可视化DAG画布编排多Agent协作流程
- **知识库RAG搜索** — 测试模式库 + Bug知识库 + AI语义搜索
- **实时协作** — WebSocket/SSE实时推送测试进度

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI框架 |
| Vite | 8.x | 构建工具（代码分割 + 懒加载） |
| TypeScript | 6.x | 类型安全 |
| Tailwind CSS | 4.x | 样式系统 |
| Zustand | 5.x | 状态管理 |
| React Router | 7.x | 路由 |
| TanStack Query | 5.x | 数据请求缓存 |
| Recharts | 3.x | 图表可视化 |
| Framer Motion | 12.x | 动画 |
| Lucide React | 1.x | 图标库 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115.x | Web框架 |
| SQLAlchemy | 2.0.x | ORM（异步） |
| SQLite | - | 数据库（开发环境） |
| Pydantic | 2.x | 数据验证 |
| Loguru | 0.7.x | 日志系统 |

### AI/自动化

| 技术 | 用途 |
|------|------|
| midscene.js | 视觉驱动的网页自动化 |
| Playwright MCP | 基于MCP协议的浏览器自动化 |
| Browser Use | Python AI Agent驱动浏览器（预留） |
| UI-TARS | 字节跳动多模态GUI Agent（预留） |
| 阿里云DashScope | qwen-vl-max 视觉模型 |
| OpenAI API | LLM对话（DeepSeek） |

## 项目结构

```
tts-paper-test/
├── frontend/                 # 前端 React 19 应用
│   ├── src/
│   │   ├── components/       # 共享组件（Skeleton、AiAssistant等）
│   │   ├── hooks/            # 自定义Hooks
│   │   ├── lib/              # API客户端、工具函数
│   │   ├── pages/            # 页面组件（12个模块）
│   │   └── stores/           # Zustand状态管理
│   └── package.json
├── backend/                  # 后端 FastAPI 应用
│   ├── api/                  # API路由（15个模块）
│   ├── agents/               # AI Agent（探索/生成/执行）
│   ├── engines/              # 测试引擎抽象层（5种引擎）
│   ├── models/               # SQLAlchemy数据模型
│   ├── schemas/              # Pydantic Schema
│   ├── services/             # 业务逻辑层
│   ├── scripts/              # E2E测试脚本
│   └── main.py               # 应用入口
└── docs/                     # 项目文档
```

## 功能模块

### 13个核心模块

| 模块 | 功能 | 路由 |
|------|------|------|
| 登录注册 + 仪表盘 | 用户认证、统计概览、快捷入口 | `/`, `/login` |
| 需求测试 | 全流程5步骤：需求→方案→测试点→用例→评审 | `/requirement-testing` |
| 执行管理 | 执行列表、详情、调度配置 | `/executions` |
| 缺陷管理 | 列表+看板+AI根因分析+趋势图表 | `/defects` |
| 分析报告 | AI生成报告、质量概览、趋势图表 | `/reports` |
| 用户管理 | 列表+状态+角色权限+登录日志+设备管理 | `/users` |
| 系统管理 | 环境+LLM+提示词+MCP+Skills配置 | `/system` |
| AI Web自动化 | 项目管理+AI智能体+AI探索+用例生成+测试执行 | `/ai-web-automation` |
| AI用例生成 | 5步流水线自动生成测试用例 | `/ai-automation` |
| 评审管理 | AI评审弹窗+审批工作流 | 内嵌模块 |
| 基础配置 | 8个独立配置页面 | `/environments`等 |
| 知识库 | 测试模式库+Bug知识库+RAG搜索 | `/knowledge-base` |
| 流程编排 | SVG DAG画布+10种节点+执行引擎 | `/workflow-orchestration` |

### AI Agent架构

```
自然语言输入 → AI智能体面板 → 自动规划 → 多步骤执行
                              ↓
     ┌─────────────────────────────────────────────┐
     │           5种测试引擎可选                      │
     │  Midscene.js │ Playwright MCP │ Mock         │
     │  Browser Use │ UI-TARS                       │
     └─────────────────────────────────────────────┘
                              ↓
  URL探索 → 页面分析 → 用例生成 → 用例评审 → 测试执行 → 报告
```

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.12+
- Chromium（Playwright自动安装）

### 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

API文档: http://localhost:8000/docs

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问: http://localhost:5173

### 测试账号

- 用户名: `admin`
- 密码: `admin123`

### 运行E2E测试

```bash
cd backend
npx playwright install chromium
node scripts/e2e-test.mjs
```

## API概览

| 模块 | 前缀 | 端点数 |
|------|------|--------|
| 认证 | `/api/v1/auth` | 4 |
| 用户管理 | `/api/v1/users` | 12 |
| 测试生命周期 | `/api/v1/test-lifecycle` | 20+ |
| AI Web自动化 | `/api/v1/web-automation` | 10+ |
| 工作流编排 | `/api/v1/workflows` | 8 |
| 知识库 | `/api/v1/knowledge` | 8 |
| 基础配置 | `/api/v1/config` | 30+ |
| AI对话 | `/api/v1/ai` | 1 |
| 引擎管理 | `/api/v1/engines` | 5 |

## 性能优化

- **代码分割**: 23个页面组件React.lazy懒加载，首屏加载更快
- **骨架屏**: 8个加载页面使用Skeleton组件替代旋转指示器
- **轮询优化**: ExecutionDetail无运行任务时自动停止轮询

## 设计系统

- **主题**: Polaroid暖白色调（--color-paper: #FAF5F0）
- **字体**: Georgia serif (标题) + Inter/system-ui (正文)
- **阴影**: 暖色阴影（rgba(139,105,20,...)）
- **圆角**: 统一xl/2xl圆角

## 测试

| 类型 | 工具 | 覆盖 |
|------|------|------|
| 单元测试 | pytest | 后端API |
| E2E测试 | Playwright | 14项端到端测试 |
| 类型检查 | TypeScript | 前端全量类型检查 |

## License

Private - 仅供内部使用
