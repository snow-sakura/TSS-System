"""数据库模块 - SQLite持久化存储"""

import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager

# 数据库路径
DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "tss_platform.db"

def init_db():
    """初始化数据库"""
    DB_DIR.mkdir(exist_ok=True)
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 创建用户表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                email TEXT,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'active',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建需求表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirements (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT,
                doc_type TEXT DEFAULT 'text',
                status TEXT DEFAULT 'pending',
                ai_analysis TEXT,
                test_points_count INTEGER DEFAULT 0,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建测试点表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_points (
                id TEXT PRIMARY KEY,
                requirement_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                type TEXT,
                priority TEXT,
                category TEXT,
                status TEXT DEFAULT 'draft',
                created_by TEXT,
                created_at TEXT,
                FOREIGN KEY (requirement_id) REFERENCES requirements(id)
            )
        """)
        
        # 创建测试方案表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_plans (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'draft',
                ai_generated INTEGER DEFAULT 0,
                ai_suggestion TEXT,
                requirement_ids TEXT,
                test_point_ids TEXT,
                approved_by TEXT,
                approved_at TEXT,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建测试用例表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_cases (
                id TEXT PRIMARY KEY,
                plan_id TEXT,
                test_point_id TEXT,
                title TEXT NOT NULL,
                precondition TEXT,
                steps TEXT,
                expected_result TEXT,
                actual_result TEXT,
                status TEXT DEFAULT 'draft',
                priority TEXT,
                type TEXT,
                ai_generated INTEGER DEFAULT 0,
                llm_error TEXT,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (plan_id) REFERENCES test_plans(id),
                FOREIGN KEY (test_point_id) REFERENCES test_points(id)
            )
        """)
        
        # 创建测试执行表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_executions (
                id TEXT PRIMARY KEY,
                case_ids TEXT,
                status TEXT DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                current_phase TEXT,
                results TEXT,
                started_by TEXT,
                started_at TEXT,
                finished_at TEXT
            )
        """)
        
        # 创建Agent表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT,
                goal TEXT,
                backstory TEXT,
                tools TEXT,
                config TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建MCP服务表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mcp_services (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                endpoint TEXT,
                config TEXT,
                status TEXT DEFAULT 'inactive',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建Skill表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS skills (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                prompt_template TEXT,
                config TEXT,
                status TEXT DEFAULT 'active',
                version INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建提示词模板表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prompt_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT,
                template TEXT,
                variables TEXT,
                version INTEGER DEFAULT 1,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建LLM提供商表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS llm_providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                api_key TEXT,
                base_url TEXT,
                config TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建知识库测试模式表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_patterns (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT,
                content TEXT,
                tags TEXT,
                embedding_id TEXT,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建知识库Bug表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_bugs (
                id TEXT PRIMARY KEY,
                bug_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                severity TEXT,
                root_cause TEXT,
                solution TEXT,
                embedding_id TEXT,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建去AI味策略表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS de_ai_strategies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                config TEXT,
                enabled INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # 创建Web自动化脚本表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS web_scripts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                target_url TEXT,
                steps TEXT,
                status TEXT DEFAULT 'draft',
                last_run TEXT,
                last_result TEXT,
                created_by TEXT,
                created_at TEXT
            )
        """)
        
        # 创建索引以优化查询性能
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_requirements_created_at ON requirements(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_points_requirement_id ON test_points(requirement_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_cases_plan_id ON test_cases(plan_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_executions_status ON test_executions(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_web_scripts_status ON web_scripts(status)")
        
        conn.commit()
    
    # 初始化默认用户
    init_default_user()


@contextmanager
def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def json_serial(obj):
    """JSON序列化辅助函数"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def db_to_dict(row):
    """将数据库行转换为字典"""
    if row is None:
        return None
    return dict(row)


def db_to_list(rows):
    """将数据库行列表转换为字典列表"""
    return [dict(row) for row in rows]


def generate_id():
    """生成唯一ID"""
    import uuid
    return str(uuid.uuid4())[:8]


def hash_password(password):
    """密码哈希"""
    import hashlib
    return hashlib.md5(password.encode()).hexdigest()


def init_default_user():
    """初始化默认管理员用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        
        if count == 0:
            password_hash = hash_password("admin123")
            user_id = generate_id()
            now = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO users (id, username, email, password_hash, role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, "admin", "admin@tss.com", password_hash, "admin", "active", now, now))
            conn.commit()
            print("已创建默认管理员用户: admin / admin123")
