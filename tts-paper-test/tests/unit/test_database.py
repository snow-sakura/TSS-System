"""数据库模块单元测试"""

import pytest
import tempfile
import os
from pathlib import Path

# 修改数据库路径用于测试
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from web.database import (
    init_db, get_db, db_to_dict, db_to_list, 
    generate_id, hash_password, init_default_user,
    DB_PATH
)


@pytest.fixture(autouse=True)
def setup_test_db():
    """设置测试数据库"""
    # 使用临时文件作为测试数据库
    import web.database as db_module
    original_path = db_module.DB_PATH
    
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        test_db_path = f.name
    
    db_module.DB_PATH = Path(test_db_path)
    
    # 初始化测试数据库
    init_db()
    
    yield
    
    # 清理
    db_module.DB_PATH = original_path
    if os.path.exists(test_db_path):
        os.unlink(test_db_path)


def test_generate_id():
    """测试ID生成"""
    id1 = generate_id()
    id2 = generate_id()
    
    assert len(id1) == 8
    assert len(id2) == 8
    assert id1 != id2


def test_hash_password():
    """测试密码哈希"""
    password = "test123"
    hashed = hash_password(password)
    
    assert hashed != password
    assert len(hashed) == 32  # MD5哈希长度
    assert hash_password(password) == hashed  # 相同密码产生相同哈希


def test_init_default_user():
    """测试初始化默认用户"""
    from web.database import get_db, db_to_dict
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = 'admin'")
        user = db_to_dict(cursor.fetchone())
    
    assert user is not None
    assert user["username"] == "admin"
    assert user["role"] == "admin"
    assert user["status"] == "active"


def test_db_to_dict():
    """测试数据库行转字典"""
    # 创建测试数据
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, username, email, password_hash, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("test1234", "testuser", "test@test.com", "hash123", "user", "active", "2024-01-01", "2024-01-01"))
        conn.commit()
        
        cursor.execute("SELECT * FROM users WHERE id = 'test1234'")
        row = cursor.fetchone()
        result = db_to_dict(row)
    
    assert result is not None
    assert result["username"] == "testuser"
    assert result["email"] == "test@test.com"


def test_db_to_list():
    """测试数据库行列表转字典列表"""
    # 创建测试数据
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, username, email, password_hash, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("test12345", "testuser2", "test2@test.com", "hash456", "user", "active", "2024-01-01", "2024-01-01"))
        conn.commit()
        
        cursor.execute("SELECT * FROM users")
        rows = cursor.fetchall()
        result = db_to_list(rows)
    
    assert len(result) >= 1
    assert any(r["username"] == "testuser2" for r in result)


def test_get_db_context_manager():
    """测试数据库连接上下文管理器"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
    
    assert result[0] == 1
