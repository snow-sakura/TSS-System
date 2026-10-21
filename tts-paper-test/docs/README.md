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

### 规格与操作手册（v3 新增）
| 文件 | 说明 |
|------|------|
| [SPEC-001 需求规格](./specs/SPEC-001-序列调度与结果可靠性/requirements-spec.md) | 序列调度与结果可靠性 — 用户故事/验收标准 |
| [SPEC-001 技术设计](./specs/SPEC-001-序列调度与结果可靠性/technical-design.md) | 架构/数据模型/调度算法/SSE 协议 |
| [SPEC-001 实施计划](./specs/SPEC-001-序列调度与结果可靠性/implementation-plan.md) | 任务拆解与进度 |
| [OPERATION_MANUAL.md](./OPERATION_MANUAL.md) | **操作手册** — 含截图的完整使用指南与 FAQ |
| [screenshots/](./screenshots/) | 功能验证截图（登录/序列调度/全流程/记录） |

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
