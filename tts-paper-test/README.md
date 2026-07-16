# TSS AI测试平台

一个基于AI的智能软件测试平台，支持完整的测试流程自动化。

## 项目结构

```
tts-paper-test/
├── frontend/                    # 前端（HTML/CSS/JS）
│   ├── templates/              # HTML模板（18个页面）
│   ├── layouts/                # 布局模板（base/sub_page）
│   └── static/                 # 静态资源
│       ├── css/               # 样式文件（暖色调主题）
│       └── js/                # JavaScript
│
├── backend/                    # 后端（Python）
│   ├── app.py                 # Flask主应用（Blueprint架构）
│   ├── database.py            # SQLite数据库模块
│   ├── security.py            # 安全模块（CSRF/XSS/速率限制）
│   ├── rate_limit.py          # 速率限制
│   ├── cache.py               # 内存缓存
│   ├── services/              # 服务模块
│   │   └── llm_service.py     # LLM服务（OpenAI/Anthropic）
│   └── data/                  # 数据存储
│
├── agents/                    # AI Agent模块
├── core/                      # 核心模块
├── knowledge/                 # 知识库
├── prompts/                   # 提示词模板
├── tests/                     # 测试代码
│
├── main.py                    # 主入口
├── requirements.txt           # Python依赖
├── start.sh                   # 启动脚本
└── README.md                  # 项目文档
```

## 功能模块

### 核心测试流程

| 模块 | 说明 | 路由 |
|------|------|------|
| 需求分析 | AI驱动的需求分析，文件上传支持 | `/requirements` |
| 测试点管理 | 智能测试点生成，批量操作 | `/test-points` |
| 测试方案 | 模板驱动，4种预置方案 | `/test-plans` |
| 测试用例 | CSV导入导出，批量管理 | `/test-cases` |
| 测试执行 | 多用例批量执行，实时进度 | `/executions` |
| 分析报告 | 趋势图、分布图、导出 | `/reports` |

### 扩展测试

| 模块 | 说明 | 路由 |
|------|------|------|
| Web自动化测试 | 脚本录制、执行、导入导出 | `/web-automation` |
| API测试 | 8个API路由，批量运行 | `/api-testing` |
| 性能测试 | 负载测试，P50/P90/P99指标 | `/performance-testing` |

### 配置管理

| 模块 | 说明 | 路由 |
|------|------|------|
| 知识库 | 测试模式/Bug知识，CSV导入导出 | `/knowledge` |
| Agent配置 | 5个专业Agent，工具集成 | `/agents` |
| MCP服务 | 服务管理，健康检查 | `/mcp-services` |
| Skill配置 | 技能管理，提示词模板 | `/skills` |
| 提示词工程 | 模板复制、批量删除 | `/prompts` |
| 大模型配置 | OpenAI/Anthropic，复制/批量删除 | `/llm` |

### 系统管理

| 模块 | 说明 | 路由 |
|------|------|------|
| 去AI味 | 同义词替换、句式重组 | `/de-ai` |
| 用户管理 | 多用户、角色权限控制 | `/users` |
| 系统设置 | 配置导入/导出/重置 | `/settings` |

## 前端设计

- **拍立得暖色调主题**: Tailwind CSS暖色调配色（warm/apricot/blush色阶）
- **左右布局子页面**: 所有功能模块使用 `layouts/sub_page.html` 基础布局
- **模块卡片首页**: 首页按功能分组展示模块卡片
- **响应式设计**: 支持桌面和移动端访问

### 布局结构

```
base.html (主布局)
├── 侧边栏导航（模块分组）
├── 顶栏（搜索/通知/用户）
└── 内容区

layouts/sub_page.html (子页面布局)
├── 左侧子菜单（当前模块子功能）
└── 右侧内容区（CRUD/表格/图表）
```

### 模块分组

| 分组 | 页面 |
|------|------|
| 核心测试流程 | 需求分析、测试点、测试方案、测试用例、测试执行、分析报告 |
| 扩展测试 | Web自动化、API测试、性能测试 |
| 配置管理 | 知识库、Agent、MCP服务、Skill、提示词、大模型 |
| 系统管理 | 去AI味、用户管理、系统设置 |

## 技术栈

| 组件 | 技术 |
|------|------|
| Web框架 | Flask + Flask-SocketIO |
| 数据库 | SQLite（16表 + 8索引） |
| AI/LLM | OpenAI API, Anthropic API |
| 前端 | HTML5, Tailwind CSS, JavaScript |
| 图表 | Chart.js |
| 图标 | Font Awesome |
| 实时通信 | WebSocket (Socket.io) |

## 快速开始

### 环境要求

- Python 3.10+
- pip

### 安装依赖

```bash
cd tts-paper-test
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py web
```

访问 http://localhost:5001

默认账户: admin / admin123

### 构建前端CSS

```bash
npm install
npm run build:css
```

## API接口

共100+个API接口，覆盖15个功能模块：

| 模块 | 接口数 | 说明 |
|------|--------|------|
| auth | 3 | 用户认证 |
| users | 5 | 用户管理 |
| requirements | 9 | 需求管理 |
| test-points | 6 | 测试点管理 |
| test-plans | 7 | 测试方案管理 |
| test-cases | 6 | 测试用例管理 |
| executions | 4 | 测试执行 |
| reports | 1 | 分析报告 |
| web-scripts | 9 | Web自动化脚本 |
| knowledge | 8 | 知识库管理 |
| agents | 4 | Agent配置 |
| mcp-services | 5 | MCP服务 |
| skills | 4 | Skill配置 |
| prompts | 5 | 提示词模板 |
| llm | 7 | LLM提供商 |
| de-ai | 5 | 去AI味策略 |

## 使用指南

### 1. 需求分析

1. 进入"需求分析"页面
2. 点击"新建需求"创建需求
3. 点击"AI分析"让AI分析需求
4. 查看分析结果，点击"创建测试点"
5. 批准需求

### 2. 测试执行

1. 进入"测试用例"页面
2. 点击"AI生成"生成测试用例
3. 进入"测试执行"页面
4. 选择要执行的用例
5. 点击"开始执行"
6. 实时查看执行进度
7. 查看分析报告

### 3. LLM配置

1. 进入"大模型配置"页面
2. 点击"添加提供商"
3. 选择提供商类型（OpenAI/Anthropic）
4. 填写API密钥
5. 点击测试连接验证

### 4. Web自动化测试

1. 进入"Web自动化"页面
2. 点击"新建脚本"
3. 填写脚本信息和测试步骤
4. 保存并执行脚本

## 许可证

MIT License
