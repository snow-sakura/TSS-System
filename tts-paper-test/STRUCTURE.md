# 项目目录结构说明

```
tts-paper-test/
│
├── web/                          # Web应用（前端+后端）
│   ├── app.py                   # Flask主应用（统一入口）
│   ├── frontend/                # 前端路由模块
│   │   ├── __init__.py
│   │   └── routes.py           # 页面路由
│   ├── api/                     # API模块（预留）
│   │   └── __init__.py
│   ├── services/                # 服务模块
│   │   └── llm_service.py      # LLM服务（OpenAI/Anthropic）
│   ├── utils/                   # 工具模块（预留）
│   ├── static/                  # 静态资源
│   │   ├── css/style.css       # 样式文件
│   │   └── js/main.js          # JavaScript
│   ├── templates/               # HTML模板（17个页面）
│   └── data/                    # 数据存储（SQLite数据库）
│
├── agents/                      # AI Agent模块
│   ├── planner.py              # 规划Agent
│   ├── generator.py            # 生成Agent
│   ├── executor.py             # 执行Agent
│   ├── reviewer.py             # 评审Agent
│   ├── analyzer.py             # 分析Agent
│   ├── skills_integration.py   # Skills集成
│   ├── config/                 # Agent配置
│   ├── crews/                  # 团队编排
│   ├── flows/                  # 工作流
│   └── tools/                  # 工具集
│
├── core/                        # 核心模块
│   ├── config.py               # 配置管理
│   ├── models.py               # 数据模型
│   └── exceptions.py           # 异常定义
│
├── knowledge/                   # 知识库
│   ├── vector_store.py         # 向量存储
│   ├── test_patterns/          # 测试模式（Markdown）
│   └── bug_knowledge/          # Bug知识（JSON）
│
├── prompts/                     # 提示词模板
│   ├── test_generation.py      # 测试生成
│   ├── test_review.py          # 测试评审
│   ├── bug_analysis.py         # Bug分析
│   └── report_summary.py       # 报告摘要
│
├── tests/                       # 测试代码
│   ├── api/                    # API测试
│   └── unit/                   # 单元测试
│
├── scripts/                     # 工具脚本
│   └── init_knowledge.py       # 知识库初始化
│
├── reports/                     # 测试报告输出
│
├── docs/                        # 文档
│
├── main.py                      # 主入口（CLI）
├── start.sh                     # 启动脚本
├── requirements.txt             # Python依赖
├── pyproject.toml              # 项目配置
├── README.md                   # 项目文档
├── STRUCTURE.md                # 目录结构说明
└── .env.example                # 环境变量模板
```

## 模块说明

### web/ - Web应用
包含前端路由、后端API、服务层和静态资源。

### agents/ - AI Agent模块
多智能体协作系统，包含5个专业Agent。

### core/ - 核心模块
配置管理、数据模型、异常定义。

### knowledge/ - 知识库
测试模式和Bug知识的向量存储。

### prompts/ - 提示词模板
AI生成所需的提示词模板。

### tests/ - 测试代码
单元测试和API测试。

### scripts/ - 工具脚本
知识库初始化等工具脚本。
