# SPEC-001 实现规划 — 序列执行调度与生成结果可靠性

> 版本：v1.0 ｜ 推进方式：**Loop Engineering**（每模块完成 → 浏览器实测 → 截图留档 → 通过才进入下一模块）

## 任务分解与状态

| # | 任务 | 产出 | 验证方式 | 状态 |
|---|------|------|---------|------|
| T1 | Spec 三件套 | docs/specs/SPEC-001-* | 评审 | ✅ |
| T2 | 数据模型 + 轻量迁移 | models/config.py、models/sequence.py、pipeline_records 增列、_ensure_columns | 启动无报错 + PRAGMA 校验 | ⬜ |
| T3 | PipelineService 可靠性改造 | 启动建记录/阶段checkpoint/空输出判失败/断连不终止 | 中断演练 + DB 校验 | ⬜ |
| T4 | SequenceScheduler + sequence API | sequence_scheduler.py、api/sequence.py | curl/API 测试（模拟模式） | ⬜ |
| T5 | 缺陷修复 | projects-for-workflow 等 | curl 200 | ⬜ |
| T6 | 前端：模式徽标 + 序号 | PipelineHeader、Stepper/Sidebar | 浏览器截图 | ⬜ |
| T7 | 前端：序列任务中心 | SequenceCenter.tsx + 菜单 + api.ts | 浏览器串行/并行实测截图 | ⬜ |
| T8 | 全流程回归（真实模型 Pipeline 一遍） | 运行记录 + 截图 | 浏览器巡检无报错 | ⬜ |
| T9 | 文档：README（全流程+截图）/操作说明 | README.md、docs/操作说明.md | 链接可达 | ⬜ |
| T10 | GitHub Pages Demo（纯 GitHub 托管+数据） | docs/demo 或 gh-pages | 线上链接可访问 | ⬜ |
| T11 | 清理无关内容 + 隐私核查 + 提交推送 | 干净仓库 | git status/扫描 | ⬜ |

## Loop Engineering 规则

1. 每完成 T2~T7 中一项：重启后端 → Playwright 打开受影响页面 → 检查 console/网络 → 截图存 `docs/images/` → 有错立即修复再截图。
2. 验证顺序：后端接口（curl）→ 前端渲染（浏览器）→ 交互闭环（真实操作）。
3. 全部绿后才进入 T8 真实模型全流程回归。

## 清理清单（T11）

- `backend/logs/*.log*`、`.playwright-mcp/`、`test-results/`、`e2e-report/`、散落截图 `*.png`、根目录旧 `tss_dev.db`、`backend/test.db`、`backend/tss.db`（空库）、`midscene_run/` 缓存、临时调试脚本。
- 隐私：`.env`、`*.db`、密钥文件保持 gitignored；`.env.example` 脱敏。

## 风险与预案

- 免费模型限流 → 回归用串行模式 + 夜间额度窗口；演示用模拟模式。
- Vite 5173 被 comic-video 占用 → 本项目前端改用 5174 起服（CORS 已含 5174）。
