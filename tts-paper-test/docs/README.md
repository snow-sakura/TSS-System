# TSS AI测试平台 — 文档中心

> 项目: tts-paper-test / TSS (Test System Service)
> 更新: 2026-07-17

---

## 文档索引

### 📐 架构设计
| 文件 | 说明 | 版本 |
|------|------|------|
| [架构设计-v2.md](./architecture/架构设计-v2.md) | **当前方案** — 完整架构设计（技术选型/模块/布局/AI/数据库/UI） | v2.0-R2 |
| [架构设计-v1.md](./architecture/架构设计-v1.md) | 原始方案（基于PRD的初始设计） | v1.0 |

### 📋 PRD与功能清单
| 文件 | 说明 |
|------|------|
| [PRD-v1.md](./prd/PRD-v1.md) | 产品需求文档（原版） |
| [功能点清单-v1.md](./prd/功能点清单-v1.md) | 68项功能点清单（原版） |

### 📁 项目结构
```
TSS-System/
├── frontend/          # Vue 3 + shadcn-vue 前端工程
├── backend/           # FastAPI + SQLAlchemy 后端工程
├── agents/            # CrewAI → LangGraph 多智能体系统
├── knowledge/         # 知识库/向量存储
├── docs/              # 项目文档
└── scripts/           # 部署脚本
```

### 🔑 已确认的决策
- **前端主题**: 暖阳专业风（森林绿 #2E7D32 + 沉稳蓝 #1565C0）
- **AI框架**: CrewAI → LangGraph 渐进迁移
- **实施策略**: CRUD基础 + AI功能同步开发
- **数据库**: MySQL 8.0+ (生产) + SQLite (开发/单机)
