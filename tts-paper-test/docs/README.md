# TSS AI测试平台 — 文档中心

> 项目: tts-paper-test / TSS (Test System Service)
> 更新: 2026-07-22

---

## 文档索引

### 架构设计
| 文件 | 说明 | 版本 |
|------|------|------|
| [架构设计-v3.md](./architecture/架构设计-v3.md) | **当前方案** — React 19 + FastAPI + SQLite + 多引擎 | v3.0 |
| [架构设计-v2.md](./architecture/架构设计-v2.md) | 旧方案 — Vue 3 + FastAPI + MySQL | v2.0-R2 |
| [架构设计-v1.md](./architecture/架构设计-v1.md) | 原始方案（基于PRD的初始设计） | v1.0 |

### PRD与功能清单
| 文件 | 说明 |
|------|------|
| [PRD-v1.md](./prd/PRD-v1.md) | 产品需求文档（原版） |
| [功能点清单-v1.md](./prd/功能点清单-v1.md) | 68项功能点清单（原版） |

### 前端设计
| 文件 | 说明 |
|------|------|
| [frontend-design-spec.md](./frontend-design-spec.md) | **Polaroid暖白主题** — React 19 + shadcn/ui 完整UI/UX规格 |

### 启动指南
| 文件 | 说明 |
|------|------|
| [STARTUP-GUIDE.md](./STARTUP-GUIDE.md) | 后端(FastAPI)+前端(React)分离启动流程 |

### 项目结构
```
tts-paper-test/
├── frontend/          # React 19 + Vite 8 + Tailwind CSS v4 + shadcn/ui
├── backend/           # FastAPI 0.115.x + SQLAlchemy 2.0 async
│   └── engines/       # 5种测试引擎抽象层
├── docs/              # 项目文档
└── .gitignore         # 忽略敏感文件(.env, *.db等)
```

### 已确认的决策
- **前端**: React 19 + Vite 8 + Tailwind CSS v4 + shadcn/ui + Polaroid暖白主题
- **后端**: FastAPI 0.115.x + SQLAlchemy 2.0 async + SQLite（开发环境）
- **AI引擎**: 5种引擎 — Midscene.js / Playwright MCP / Mock / Browser Use / UI-TARS
- **数据库**: SQLite（开发） / PostgreSQL（生产可选）
- **日志**: 三层体系（前端Sonner+后端Loguru+文件持久化）
- **核心UX**: AI生成→人工审核编辑→确认入库
