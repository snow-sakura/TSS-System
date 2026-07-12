# TSS - Ticket Selling System

TSS 是一个基于 Flask 的售票系统，支持用户认证、目的地管理、订单管理等完整功能。

## 功能特点

### 用户认证
- **登录**：用户名密码登录
- **注册**：新用户注册
- **权限管理**：管理员/普通用户角色区分

### 购票流程
- **目的地选择**：从数据库获取目的地列表，显示价格和库存
- **票务选项**：支持单程票/多次往返票和普通座/舒适座，动态计算价格
- **支付确认**：选择支付方式（MCard 或现金）
- **车票打印**：生成完整车票信息

### 管理功能
- **仪表盘**：统计数据展示（用户数、目的地数、订单数、总收入）
- **用户管理**：用户列表、添加、编辑、删除（管理员）
- **目的地管理**：目的地列表、添加、编辑、删除（管理员）
- **订单管理**：订单列表查看、删除（管理员）

### 其他功能
- **库存管理**：购票后自动扣减库存
- **多语言支持**：支持中英文切换
- **消息提示**：右上角浮动气泡提示，自动消失

## 项目结构

```
TSS-System/
├── main.py                    # 主程序文件（后端代码）
├── requirements.txt           # 依赖清单
├── tss.db                     # SQLite 数据库文件（自动生成）
└── templates/                 # HTML 模板目录
    ├── base_admin.html        # 后台管理基础模板
    ├── login.html             # 登录页面
    ├── register.html          # 注册页面
    ├── dashboard.html         # 仪表盘
    ├── users.html             # 用户管理列表
    ├── user_form.html         # 用户添加/编辑表单
    ├── destinations.html      # 目的地管理列表
    ├── destination_form.html  # 目的地添加/编辑表单
    ├── tickets.html           # 订单列表
    ├── index.html             # 首页（购票入口）
    ├── select_destination.html # 选择目的地
    ├── select_options.html    # 选择票种座位
    ├── payment.html           # 支付页面
    └── print_ticket.html      # 车票打印
```

## 安装与运行

### 环境要求
- Python 3.6+
- SQLite（Python 内置，无需额外安装）

### 安装步骤

#### 安装依赖
```bash
pip install -r requirements.txt
```

#### 运行程序
```bash
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

### 仪表盘
- 查看系统统计数据
- 查看最近订单列表

### 用户管理（管理员）
- 查看所有用户列表
- 添加、编辑、删除用户

### 目的地管理（管理员）
- 查看所有目的地
- 添加新目的地（代码、名称、价格、库存）
- 编辑、删除目的地

### 购票流程
1. 点击"购票"进入首页
2. 点击"开始购票"选择目的地
3. 选择票种和座位类型
4. 确认支付方式并完成支付
5. 查看打印车票

## API 接口

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/login` | POST | 用户登录 |
| `/api/register` | POST | 用户注册 |
| `/api/users` | GET | 获取用户列表（分页） |
| `/api/destinations` | GET | 获取目的地列表 |
| `/api/destinations` | POST | 添加目的地 |
| `/api/tickets` | GET | 获取订单列表（分页） |

## 数据库表结构

### `users`
| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 自增主键 |
| username | TEXT | 用户名（唯一） |
| password | TEXT | 密码（MD5加密） |
| email | TEXT | 邮箱 |
| role | TEXT | 角色（admin/user） |
| status | INTEGER | 状态（1启用/0禁用） |
| created_at | DATETIME | 创建时间 |

### `destinations`
| 字段 | 类型 | 描述 |
|------|------|------|
| code | TEXT | 目的地代码（主键） |
| name | TEXT | 目的地名称 |
| price | REAL | 基础价格 |
| stock | INTEGER | 剩余票数 |

### `tickets`
| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 自增主键 |
| destination_code | TEXT | 目的地代码 |
| ticket_type | TEXT | 票种 |
| seat_type | TEXT | 座位类型 |
| price | REAL | 票价 |
| purchase_time | DATETIME | 购票时间 |
| payment_method | TEXT | 支付方式 |
| status | TEXT | 票务状态 |
| user_id | INTEGER | 用户ID（外键） |

## 开发与调试

- **调试模式**：运行时启用 `debug=True`
- **数据库**：SQLite 数据库文件 `tss.db` 自动创建在项目根目录
- **初始数据**：首次运行自动创建管理员账号和示例目的地数据

## 许可证

本项目仅用于演示，未指定正式许可证。
