# API测试模式库

## 认证测试模式

### 模式：Token验证
- 无效Token拒绝（401 Unauthorized）
- 过期Token拒绝（401 Unauthorized）
- 权限不足拒绝（403 Forbidden）
- 缺少Token拒绝（401 Unauthorized）

**测试示例：**
```python
def test_invalid_token_rejected():
    """测试无效Token被拒绝"""
    response = api_client.get("/api/users", headers={"Authorization": "Bearer invalid_token"})
    assert response.status_code == 401

def test_missing_token_rejected():
    """测试缺少Token被拒绝"""
    response = api_client.get("/api/users")
    assert response.status_code == 401
```

### 模式：登录验证
- 正确用户名密码→成功登录
- 错误密码→登录失败
- 不存在的用户→登录失败
- 空用户名/密码→参数错误

**测试示例：**
```python
def test_login_success():
    """测试登录成功"""
    response = api_client.post("/api/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200
    assert "token" in response.json()

def test_login_wrong_password():
    """测试错误密码"""
    response = api_client.post("/api/login", json={
        "username": "admin",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
```

### 模式：注册验证
- 正常注册→成功
- 重复用户名→注册失败
- 无效邮箱格式→参数错误
- 密码强度不足→参数错误

**测试示例：**
```python
def test_register_success():
    """测试注册成功"""
    response = api_client.post("/api/register", json={
        "username": "newuser",
        "password": "password123",
        "email": "newuser@example.com"
    })
    assert response.status_code == 201

def test_register_duplicate_user():
    """测试重复用户名"""
    response = api_client.post("/api/register", json={
        "username": "admin",
        "password": "password123",
        "email": "admin@example.com"
    })
    assert response.status_code == 409
```

## 输入验证测试模式

### 模式：SQL注入防护
- 单引号注入
- OR 1=1 注入
- UNION注入
- 批注注入

**测试示例：**
```python
def test_sql_injection_prevention():
    """测试SQL注入防护"""
    malicious_inputs = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
    ]
    for payload in malicious_inputs:
        response = api_client.post("/api/login", json={
            "username": payload,
            "password": "test"
        })
        assert response.status_code in [400, 401]
```

### 模式：XSS防护
- `<script>`标签
- 事件处理器（onerror, onload）
- JavaScript URL

**测试示例：**
```python
def test_xss_prevention():
    """测试XSS防护"""
    xss_payloads = [
        "<script>alert('xss')</script>",
        '<img onerror="alert(1)" src="x">',
        "javascript:alert('xss')",
    ]
    for payload in xss_payloads:
        response = api_client.post("/api/destinations", json={
            "name": payload,
            "code": "TEST"
        })
        # 应该拒绝或转义输入
        assert response.status_code in [400, 201]
```

### 模式：边界值测试
- 最小值
- 最大值
- 超出范围值
- 空值
- Null值

**测试示例：**
```python
def test_boundary_values():
    """测试边界值"""
    # 测试价格边界
    test_cases = [
        {"price": -1, "expected": 400},  # 负数
        {"price": 0, "expected": 400},    # 零
        {"price": 0.01, "expected": 201}, # 最小有效值
        {"price": 999999.99, "expected": 201},  # 大值
    ]
    for case in test_cases:
        response = api_client.post("/api/destinations", json={
            "name": "Test",
            "code": "T01",
            "price": case["price"]
        })
        assert response.status_code == case["expected"]
```

### 模式：类型错误处理
- 字符串传入数字字段
- 数字传入字符串字段
- 数组传入单值字段

**测试示例：**
```python
def test_type_error_handling():
    """测试类型错误处理"""
    response = api_client.post("/api/destinations", json={
        "name": 123,  # 数字传入字符串字段
        "code": "T01",
        "price": "not_a_number"  # 字符串传入数字字段
    })
    assert response.status_code == 400
```

## 业务逻辑测试模式

### 模式：购票流程
- 库存充足→购票成功
- 库存不足→购票失败
- 并发购买→数据一致性
- 重复购买→幂等性

**测试示例：**
```python
def test_purchase_success():
    """测试购票成功"""
    response = api_client.post("/api/purchase", json={
        "destination_code": "T01",
        "ticket_type": "单程票",
        "seat_type": "普通座",
        "quantity": 1,
        "payment_method": "MCard"
    })
    assert response.status_code == 200

def test_purchase_insufficient_stock():
    """测试库存不足"""
    # 先获取当前库存
    dest_response = api_client.get("/api/destinations/T01")
    current_stock = dest_response.json()["stock"]
    
    # 尝试购买超过库存的数量
    response = api_client.post("/api/purchase", json={
        "destination_code": "T01",
        "ticket_type": "单程票",
        "seat_type": "普通座",
        "quantity": current_stock + 1,
        "payment_method": "MCard"
    })
    assert response.status_code in [400, 409]
```

### 模式：支付流程
- 正常支付→成功
- 支付超时→处理
- 余额不足→失败
- 重复支付→防止

### 模式：查询操作
- 正常查询→返回数据
- 无数据查询→空结果
- 分页查询→正确分页
- 排序查询→正确排序

**测试示例：**
```python
def test_pagination():
    """测试分页查询"""
    response = api_client.get("/api/destinations?page=1&per_page=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) <= 10

def test_empty_query_result():
    """测试空结果查询"""
    response = api_client.get("/api/destinations?search=nonexistent")
    assert response.status_code == 200
    assert response.json()["items"] == []
```

## 错误处理测试模式

### 模式：HTTP状态码
- 200 OK - 成功
- 400 Bad Request - 请求错误
- 401 Unauthorized - 未认证
- 403 Forbidden - 无权限
- 404 Not Found - 资源不存在
- 500 Internal Server Error - 服务器错误

**测试示例：**
```python
def test_404_not_found():
    """测试资源不存在"""
    response = api_client.get("/api/nonexistent")
    assert response.status_code == 404

def test_405_method_not_allowed():
    """测试HTTP方法不允用"""
    response = api_client.put("/api/login", json={})
    assert response.status_code == 405
```

### 模式：错误响应格式
- 包含error字段
- 包含message字段
- 包含details字段（可选）

**测试示例：**
```python
def test_error_response_format():
    """测试错误响应格式"""
    response = api_client.post("/api/login", json={
        "username": "",
        "password": ""
    })
    assert response.status_code == 400
    data = response.json()
    assert "error" in data or "message" in data
```
