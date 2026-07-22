# AISQA · AI 测试平台 — 启动指南

> 本文档涵盖 `tts-paper-test/`（v2 活跃项目）的完整启动流程。
> 另一个 `tts-paper-system/` 是已归档的旧版 Flask 项目，与此无关。

---

## 目录

- [环境要求](#环境要求)
- [一、后端启动](#一后端启动)
- [二、前端启动](#二前端启动)
- [三、访问应用](#三访问应用)
- [四、常见问题](#四常见问题)
- [五、可选配置](#五可选配置)

---

## 环境要求

| 工具 | 版本要求 | 检查命令 |
|------|---------|---------|
| **Python** | 3.12+ | `python3 --version` |
| **Node.js** | 20+ | `node --version` |
| **npm** | 10+ | `npm --version` |

---

## 一、后端启动

后端是 FastAPI 应用，用最简单的 `python main.py` 一键启动。

### 1.1 创建虚拟环境（首次）

```bash
# 进入项目目录
cd tts-paper-test

# 创建 Python 虚拟环境
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate       # macOS / Linux
# .venv\Scripts\activate        # Windows
```

### 1.2 安装后端依赖

```bash
# 核心依赖（必须）
pip install -r backend/requirements.txt

# AI Agent 依赖（可选，不安装则自动降级为模拟模式）
pip install -r backend/requirements-ai.txt

# 生产环境依赖（可选，MySQL + 数据库迁移）
pip install -r backend/requirements-prod.txt
```

> 💡 **提示**：如果只需基础功能运行，只装 `requirements.txt` 即可。

### 1.3 配置环境变量

```bash
# 复制示例配置文件
cp .env.example .env
```

然后编辑 `.env`，按需修改配置（开发环境通常无需改动即可启动）：

```
DATABASE_URL=sqlite:///./tss_dev.db    # 开发用 SQLite，无需额外安装数据库
```

### 1.4 启动后端服务

```bash
# 确保在 tts-paper-test/ 目录下，且虚拟环境已激活
python main.py
```

终端输出如下即表示启动成功：

```
INFO:     TSS AI测试平台 v1.0.0 启动
INFO:     数据库: sqlite:///./tss_dev.db...
INFO:     Uvicorn running on http://0.0.0.0:8000
```

> 💡 生产模式：`python main.py --prod`（关闭热重载）

### 默认账号

首次启动时，系统会自动创建以下账号（仅数据库为空时创建一次）：

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| `admin` | `admin123` | **管理员** | 拥有全部系统权限 |
| `testuser` | `test123` | 测试工程师 | 普通测试人员账号 |

---

## 二、前端启动

## 二、前端启动

前端是 React 19 + Vite + Tailwind CSS v4 应用。

### 2.1 安装前端依赖（首次）

```bash
cd frontend
npm install
```

### 2.2 启动前端开发服务器

```bash
npm run dev
```

终端输出如下：

```
VITE v6.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://xxx.xxx.xxx.xxx:5173/
```

---

## 三、访问应用

启动前后端后，打开浏览器访问：

| 地址 | 说明 |
|------|------|
| **http://localhost:5173** | 前端页面（推荐） |
| **http://localhost:8000/docs** | 后端 Swagger API 文档 |
| **http://localhost:8000/redoc** | 后端 ReDoc API 文档 |

> 前端开发模式下（:5173），Vite 会自动将 `/api/*` 请求代理到后端 `:8000`，无需额外配置。

### 流程图

```
浏览器 (:5173)
  │
  ├── 静态资源 ← Vite Dev Server
  │
  └── /api/* 请求 ──代理──→ FastAPI (:8000)
                                  │
                                  └── SQLite (tss_dev.db)
```

---

## 四、常见问题

### Q: 启动后端时提示 `ModuleNotFoundError`

确保：
1. 虚拟环境已激活（终端提示符前有 `(.venv)`）
2. 依赖已安装：`pip install -r backend/requirements.txt`
3. 命令在 `tts-paper-test/` 目录下执行

### Q: 端口被占用

```bash
# 查看端口占用
lsof -i :8000    # 后端端口
lsof -i :5173    # 前端端口

# 终止进程
kill -9 <PID>
```

### Q: 前端页面空白 / API 请求返回 404

1. 后端是否已启动（`:8000`）？
2. 前端代理配置是否正确？检查 `frontend/vite.config.ts`：

```ts
proxy: {
  '/api': {
    target: 'http://localhost:8000',  // 确保指向后端地址
    changeOrigin: true,
  },
}
```

### Q: 数据库相关

- SQLite 数据库文件自动生成在 `tts-paper-test/` 下（`tss_dev.db`）
- 每次启动时自动创建/更新表结构，无需手动迁移
- 想重置数据库？删除 `tss_dev.db` 文件后重启即可

---

## 五、可选配置

### 5.1 生产构建

```bash
cd frontend
npm run build        # 运行 tsc -b && vite build
npm run preview      # 本地预览生产构建
```

构建产物在 `frontend/dist/` 目录。

### 5.2 AI Agent 功能

AI Agent 功能默认以**模拟模式**运行（无需 CrewAI）。如需使用真实的 AI 推理：

1. 安装 AI 依赖：`pip install -r backend/requirements-ai.txt`
2. 在 `.env` 中配置 API Key：
   ```
   OPENAI_API_KEY=sk-your-key
   OPENAI_BASE_URL=https://api.openai.com/v1
   ```

### 5.3 生产环境（MySQL）

1. 安装生产依赖：`pip install -r backend/requirements-prod.txt`
2. 修改 `.env`：
   ```
   DATABASE_URL=mysql+pymysql://user:password@localhost:3306/tss_prod?charset=utf8mb4
   ```

---

> **快速回顾**：只需要两个终端窗口：
> ```bash
> cd tts-paper-test && python main.py          # 终端 1 — 后端
> cd tts-paper-test/frontend && npm run dev    # 终端 2 — 前端
> ```
