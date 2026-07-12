# TSS - Ticket Selling System

TSS 是一个基于 Flask 的在线售票系统，支持完整的用户认证、目的地管理、订单管理、支付流程和车票打印功能。

## 功能特点

### 用户认证
- **登录**：用户名密码登录（MD5 加密存储）
- **注册**：新用户注册，支持邮箱填写
- **权限管理**：管理员/普通用户角色区分
- **登出**：安全退出并清除会话

### 购票流程
- **目的地选择**：从数据库获取目的地列表，显示价格和库存
- **票务选项**：支持单程票/多次往返票和普通座/舒适座，动态计算价格
- **价格计算**：多次往返票 1.5x，舒适座 1.2x（可叠加）
- **支付确认**：选择支付方式（MCard 或现金）
- **车票打印**：生成完整车票信息（含随机票号）

### 管理功能
- **仪表盘**：统计数据展示（用户数、目的地数、订单数、总收入、最近订单）
- **用户管理**：用户列表（分页）、添加、编辑、删除（管理员）
- **目的地管理**：目的地列表、添加、编辑、删除（管理员）
- **订单管理**：订单列表查看（分页）、删除（管理员），删除时自动恢复库存

### 其他功能
- **库存管理**：购票后自动扣减库存，删除订单自动恢复
- **多语言支持**：支持中英文切换
- **消息提示**：右上角浮动气泡提示，自动消失
- **会话管理**：基于 Flask Session 的会话状态管理

## 项目结构

```
TSS-System/
├── main.py                      # 主程序文件（后端代码，含所有路由和业务逻辑）
├── requirements.txt             # Python 依赖清单
├── tss.db                       # SQLite 数据库文件（自动生成）
├── README.md                    # 项目文档
├── .gitignore                   # Git 忽略配置
└── templates/                   # HTML 模板目录
    ├── base_admin.html          # 后台管理基础模板（导航栏、消息提示）
    ├── login.html               # 登录页面
    ├── register.html            # 注册页面
    ├── dashboard.html           # 管理员仪表盘
    ├── users.html               # 用户管理列表（分页）
    ├── user_form.html           # 用户添加/编辑表单
    ├── destinations.html        # 目的地管理列表
    ├── destination_form.html    # 目的地添加/编辑表单
    ├── tickets.html             # 订单列表（分页）
    ├── index.html               # 首页（购票入口）
    ├── select_destination.html  # 选择目的地
    ├── select_options.html      # 选择票种和座位
    ├── payment.html             # 支付页面
    └── print_ticket.html        # 车票打印
```

## 技术栈

- **后端**：Python 3.6+ / Flask 3.1.3
- **数据库**：SQLite（Python 内置，无需额外安装）
- **前端**：HTML / CSS / JavaScript
- **密码加密**：MD5（hashlib）
- **会话管理**：Flask Session

## 安装与运行

### 环境要求
- Python 3.6+
- pip（Python 包管理器）

### 安装步骤

```bash
# 克隆项目
git clone https://github.com/snow-sakura/TSS-System.git
cd TSS-System

# 创建虚拟环境（推荐）
python3 -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 运行程序
python3 main.py
```

程序启动后，访问 [http://127.0.0.1:5000/login](http://127.0.0.1:5000/login)。

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |

## 使用说明

### 登录/注册
- 访问 `/login` 登录系统
- 访问 `/register` 注册新用户

### 仪表盘（管理员）
- 查看系统统计数据（用户数、目的地数、订单数、总收入）
- 查看最近 5 笔订单

### 用户管理（管理员）
- 查看所有用户列表（分页，每页 10 条）
- 添加新用户（设置用户名、密码、邮箱、角色）
- 编辑用户信息（支持修改密码、角色、状态）
- 删除用户

### 目的地管理（管理员）
- 查看所有目的地
- 添加新目的地（代码、名称、价格、库存）
- 编辑、删除目的地

### 购票流程
1. 登录后点击"购票"进入首页
2. 点击"开始购票"选择目的地
3. 选择票种（单程票/多次往返票）和座位类型（普通座/舒适座）
4. 确认支付方式（MCard/现金）并完成支付
5. 查看打印车票

### 订单管理
- 普通用户：查看自己的订单
- 管理员：查看所有订单，支持删除（自动恢复库存）

## API 接口

| 接口 | 方法 | 功能 | 说明 |
|------|------|------|------|
| `/api/login` | POST | 用户登录 | JSON: `{username, password}` |
| `/api/register` | POST | 用户注册 | JSON: `{username, password, confirm_password, email}` |
| `/api/users` | GET | 获取用户列表 | 分页: `?page=1` |
| `/api/destinations` | GET | 获取目的地列表 | 返回所有目的地 |
| `/api/destinations` | POST | 添加目的地 | JSON: `{code, name, price, stock}` |
| `/api/tickets` | GET | 获取订单列表 | 分页: `?page=1` |

## 数据库表结构

### `users` - 用户表
| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 自增主键 |
| username | TEXT | 用户名（唯一） |
| password | TEXT | 密码（MD5 加密） |
| email | TEXT | 邮箱 |
| role | TEXT | 角色（admin/user） |
| status | INTEGER | 状态（1 启用 / 0 禁用） |
| created_at | DATETIME | 创建时间 |

### `destinations` - 目的地表
| 字段 | 类型 | 描述 |
|------|------|------|
| code | TEXT | 目的地代码（主键） |
| name | TEXT | 目的地名称 |
| price | REAL | 基础价格 |
| stock | INTEGER | 剩余票数 |

### `tickets` - 订单表
| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 自增主键 |
| destination_code | TEXT | 目的地代码（外键） |
| ticket_type | TEXT | 票种（单程票/多次往返票） |
| seat_type | TEXT | 座位类型（普通座/舒适座） |
| price | REAL | 实际票价 |
| purchase_time | DATETIME | 购票时间 |
| payment_method | TEXT | 支付方式 |
| status | TEXT | 票务状态 |
| user_id | INTEGER | 用户 ID（外键） |

## 价格计算规则

| 票种 | 座位 | 价格倍率 |
|------|------|----------|
| 单程票 | 普通座 | 1.0x（基础价格） |
| 单程票 | 舒适座 | 1.2x |
| 多次往返票 | 普通座 | 1.5x |
| 多次往返票 | 舒适座 | 1.8x |

## 路由说明

| 路由 | 方法 | 需要登录 | 需要管理员 | 功能 |
|------|------|----------|------------|------|
| `/login` | GET/POST | 否 | 否 | 登录页面 |
| `/register` | GET/POST | 否 | 否 | 注册页面 |
| `/logout` | GET | 否 | 否 | 退出登录 |
| `/dashboard` | GET | 是 | 是 | 管理员仪表盘 |
| `/users` | GET | 是 | 是 | 用户列表 |
| `/users/add` | GET/POST | 是 | 是 | 添加用户 |
| `/users/edit/<id>` | GET/POST | 是 | 是 | 编辑用户 |
| `/users/delete/<id>` | GET | 是 | 是 | 删除用户 |
| `/destinations` | GET | 是 | 是 | 目的地列表 |
| `/destinations/add` | GET/POST | 是 | 是 | 添加目的地 |
| `/destinations/edit/<code>` | GET/POST | 是 | 是 | 编辑目的地 |
| `/destinations/delete/<code>` | GET | 是 | 是 | 删除目的地 |
| `/tickets` | GET | 是 | 否 | 订单列表 |
| `/tickets/delete/<id>` | GET | 是 | 是 | 删除订单 |
| `/` | GET/POST | 是 | 否 | 首页/购票入口 |
| `/select_destination` | GET/POST | 是 | 否 | 选择目的地 |
| `/select_options` | GET/POST | 是 | 否 | 选择票种座位 |
| `/payment` | GET/POST | 是 | 否 | 支付页面 |
| `/print_ticket` | GET | 是 | 否 | 车票打印 |
| `/set_language/<lang>` | GET | 否 | 否 | 切换语言 |

## 开发与调试

- **调试模式**：`main.py` 中 `app.run(debug=True)` 启用
- **数据库**：SQLite 数据库文件 `tss.db` 自动创建在项目根目录
- **初始数据**：首次运行自动创建管理员账号和示例目的地数据（总站、南站、东站）
- **虚拟环境**：推荐使用 `.venv` 虚拟环境隔离依赖

## 许可证

本项目仅用于演示，未指定正式许可证。
