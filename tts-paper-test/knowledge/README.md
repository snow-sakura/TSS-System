# 知识库文档

## 概述

TSS Paper Test 的知识库用于存储测试模式、Bug知识和历史测试结果，为AI Agent提供智能检索和参考。

## 目录结构

```
knowledge/
├── test_patterns/           # 测试模式知识库
│   ├── api_patterns.md      # API测试模式
│   ├── auth_patterns.md     # 认证测试模式
│   └── error_patterns.md    # 错误处理模式
├── bug_knowledge/           # Bug知识库
│   └── known_bugs.json      # 已知Bug列表
├── vector_store.py          # 向量存储管理
└── README.md                # 本文档
```

## 测试模式

### API测试模式
- 认证测试：Token验证、登录验证、注册验证
- 输入验证：SQL注入、XSS防护、边界值测试
- 业务逻辑：购票流程、支付流程、查询操作
- 错误处理：HTTP状态码、错误响应格式

### 认证测试模式
- 会话管理：会话创建、维持、销毁
- 权限控制：角色验证、资源访问控制
- 安全测试：密码安全、会话安全、CSRF防护

### 错误处理模式
- 异常场景：网络异常、服务不可用、数据异常
- 输入验证：必填字段、格式错误、长度超限
- 业务错误：库存不足、余额不足、操作冲突

## Bug知识

### 已知Bug
- BUG-001: 并发购票导致库存不一致
- BUG-002: 登录会话未正确失效
- BUG-003: 分页查询边界条件处理不当
- BUG-004: 重复提交表单导致重复数据

## 使用方法

### 初始化知识库
```bash
python scripts/init_knowledge.py
```

### 测试知识库
```bash
python scripts/test_knowledge.py
```

### 在代码中使用
```python
from knowledge.vector_store import knowledge_store

# 搜索测试模式
patterns = knowledge_store.search_test_patterns("认证测试")

# 搜索Bug知识
bugs = knowledge_store.search_bug_knowledge("并发问题")

# 获取统计信息
stats = knowledge_store.get_stats()
```

## 添加新知识

### 添加测试模式
编辑 `test_patterns/` 目录下的markdown文件，添加新的测试模式。

### 添加Bug知识
编辑 `bug_knowledge/known_bugs.json` 文件，添加新的Bug记录。

### 运行初始化
```bash
python scripts/init_knowledge.py
```

## 技术实现

### 向量存储
- 使用ChromaDB作为向量数据库
- 支持余弦相似度搜索
- 自动持久化存储

### 嵌入模型
- 默认使用sentence-transformers/all-MiniLM-L6-v2
- 支持自定义嵌入模型

### 检索策略
- 基于语义相似度的检索
- 支持多条件过滤
- 返回相关度排序结果
