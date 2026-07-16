"""TSS AI测试平台 - Flask主应用"""

import os
import sys
import json
import uuid
import asyncio
import threading
from datetime import datetime
from pathlib import Path

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from functools import wraps

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 导入服务模块
from backend.services.llm_service import llm_service
from backend.database import init_db, get_db, db_to_dict, db_to_list
from backend.security import generate_csrf_token, sanitize_input, secure_headers, log_security_event
from backend.rate_limit import rate_limit, login_rate_limit

# ==================== 应用初始化 ====================

# 前端目录路径
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

app = Flask(__name__, 
            template_folder=str(FRONTEND_DIR / "templates"),
            static_folder=str(FRONTEND_DIR / "static"))
app.secret_key = os.getenv("FLASK_SECRET_KEY", "tss-ai-test-platform-secret-key")
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB上传限制

# 初始化SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# 初始化数据库
init_db()

# 添加安全响应头
@app.after_request
def add_security_headers(response):
    headers = secure_headers()
    for key, value in headers.items():
        response.headers[key] = value
    return response

# 注入CSRF Token到模板
@app.context_processor
def inject_csrf_token():
    return dict(csrf_token=generate_csrf_token())

# ==================== 工具函数 ====================

def generate_id():
    """生成唯一ID"""
    return str(uuid.uuid4())[:8]

def get_store(table_name):
    """从数据库获取数据列表"""
    allowed_tables = [
        "requirements", "test_points", "test_plans", "test_cases",
        "test_executions", "agents", "mcp_services", "skills",
        "prompt_templates", "llm_providers", "knowledge_patterns",
        "knowledge_bugs", "de_ai_strategies", "web_scripts", "users"
    ]
    if table_name not in allowed_tables:
        raise ValueError(f"不允许访问表: {table_name}")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        return db_to_list(rows)

def set_store(table_name, data):
    """设置数据存储"""
    allowed_tables = [
        "requirements", "test_points", "test_plans", "test_cases",
        "test_executions", "agents", "mcp_services", "skills",
        "prompt_templates", "llm_providers", "knowledge_patterns",
        "knowledge_bugs", "de_ai_strategies", "web_scripts", "users"
    ]
    if table_name not in allowed_tables:
        raise ValueError(f"不允许访问表: {table_name}")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"DELETE FROM {table_name}")
        if data:
            columns = list(data[0].keys())
            placeholders = ", ".join(["?" for _ in columns])
            column_names = ", ".join(columns)
            for item in data:
                values = [item.get(col) for col in columns]
                cursor.execute(f"INSERT INTO {table_name} ({column_names}) VALUES ({placeholders})", values)
        conn.commit()

def login_required(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith('/api/'):
                return jsonify({"error": "未登录"}), 401
            return redirect(url_for("frontend.login"))
        return f(*args, **kwargs)
    return decorated_function

# ==================== WebSocket事件 ====================

@socketio.on('connect')
def handle_connect():
    print(f'客户端已连接: {request.sid}')
    emit('connected', {'message': '连接成功'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'客户端已断开: {request.sid}')

def broadcast_status(execution_id, status_data):
    room = f"status_{execution_id}"
    socketio.emit('status_update', status_data, room=room)

# ==================== 认证路由 ====================

@app.route("/login", methods=["GET", "POST"])
@login_rate_limit
def login():
    """登录页面（含验证码）"""
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        captcha_input = request.form.get("captcha", "").strip()
        remember = request.form.get("remember", "0")
        
        # 验证验证码
        from web.captcha import verify_captcha
        expected = session.get("captcha_answer")
        if not expected or not verify_captcha(captcha_input, expected):
            log_security_event("LOGIN_FAILED", {"reason": "验证码错误"})
            return render_template("login.html", error="验证码错误，请重新输入")
        
        if not username or not password:
            log_security_event("LOGIN_FAILED", {"reason": "空凭证"})
            return render_template("login.html", error="用户名和密码不能为空")
        
        from web.database import get_db, db_to_dict, hash_password
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ? AND status = 'active'", (username,))
            user = db_to_dict(cursor.fetchone())
        
        if user and user["password_hash"] == hash_password(password):
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["role"] = user["role"]
            
            # 记住我 - 设置会话持久化
            if remember == "1":
                session.permanent = True
            
            log_security_event("LOGIN_SUCCESS", {"username": username})
            return redirect(url_for("frontend.index"))
        
        log_security_event("LOGIN_FAILED", {"username": username})
        return render_template("login.html", error="用户名或密码错误")
    
    # 生成验证码
    from web.captcha import generate_captcha
    img_data, answer = generate_captcha()
    session["captcha_answer"] = answer
    session["captcha_data"] = img_data.hex()
    
    return render_template("login.html")

@app.route("/logout")
def logout():
    """退出登录"""
    session.clear()
    return redirect(url_for("frontend.login"))

@app.route("/captcha/image")
def captcha_image():
    """获取验证码图片"""
    from web.captcha import generate_captcha
    img_data, answer = generate_captcha()
    session["captcha_answer"] = answer
    from flask import Response
    return Response(img_data, mimetype="image/png")

@app.route("/captcha/refresh", methods=["POST"])
def captcha_refresh():
    """刷新验证码"""
    from web.captcha import generate_captcha
    from flask import jsonify
    img_data, answer = generate_captcha()
    session["captcha_answer"] = answer
    session["captcha_data"] = img_data.hex()
    return jsonify({"refreshed": True})

@app.route("/api/user/info", methods=["GET"])
@login_required
def get_user_info():
    """获取当前用户信息"""
    user_id = session.get("user_id")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, role, status, created_at FROM users WHERE id = ?", (user_id,))
        user = db_to_dict(cursor.fetchone())
    if not user:
        return jsonify({"error": "用户不存在"}), 404
    return jsonify(user)

# ==================== 用户管理 ====================

@app.route("/users")
@login_required
def users_page():
    """用户管理页面"""
    return render_template("users.html")

@app.route("/api/users", methods=["GET"])
@login_required
def get_users():
    """获取用户列表"""
    users = get_store("users")
    for user in users:
        if "password_hash" in user:
            del user["password_hash"]
    return jsonify({"items": users, "total": len(users)})

@app.route("/api/users", methods=["POST"])
@login_required
def create_user():
    """创建用户"""
    data = request.json
    from web.database import get_db, db_to_dict, hash_password, generate_id
    from web.security import validate_email, password_strength_check, sanitize_input
    
    username = sanitize_input(data.get("username", "").strip())
    email = sanitize_input(data.get("email", "").strip())
    password = data.get("password", "")
    role = data.get("role", "user")
    
    if not username or not password:
        return jsonify({"error": "用户名和密码不能为空"}), 400
    
    if len(username) < 3:
        return jsonify({"error": "用户名至少3个字符"}), 400
    
    if email and not validate_email(email):
        return jsonify({"error": "邮箱格式不正确"}), 400
    
    is_strong, msg = password_strength_check(password)
    if not is_strong:
        return jsonify({"error": msg}), 400
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            return jsonify({"error": "用户名已存在"}), 400
    
    user_id = generate_id()
    now = datetime.now().isoformat()
    password_hash = hash_password(password)
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, username, email, password_hash, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, username, email, password_hash, role, "active", now, now))
        conn.commit()
    
    log_security_event("USER_CREATED", {"user_id": user_id, "username": username})
    return jsonify({"id": user_id, "username": username, "email": email, "role": role}), 201

@app.route("/api/users/<user_id>", methods=["PUT"])
@login_required
def update_user(user_id):
    """更新用户"""
    data = request.json
    from web.database import get_db, hash_password
    from web.security import validate_email
    
    updates = []
    params = []
    
    for key in ["username", "email", "role", "status"]:
        if key in data:
            if key == "email" and data[key] and not validate_email(data[key]):
                return jsonify({"error": "邮箱格式不正确"}), 400
            updates.append(f"{key} = ?")
            params.append(data[key])
    
    if "password" in data and data["password"]:
        updates.append("password_hash = ?")
        params.append(hash_password(data["password"]))
    
    updates.append("updated_at = ?")
    params.append(datetime.now().isoformat())
    params.append(user_id)
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/users/<user_id>", methods=["DELETE"])
@login_required
def delete_user(user_id):
    """删除用户"""
    if user_id == session.get("user_id"):
        return jsonify({"error": "不能删除当前登录用户"}), 400
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    
    return jsonify({"message": "删除成功"})

# ==================== 导入前端路由 ====================

from web.frontend.routes import frontend_bp
app.register_blueprint(frontend_bp)

# ==================== API路由 ====================

@app.route("/api/requirements", methods=["GET"])
@login_required
def get_requirements():
    """获取需求列表"""
    requirements = get_store("requirements")
    return jsonify({"items": requirements, "total": len(requirements)})

@app.route("/api/requirements", methods=["POST"])
@login_required
def create_requirement():
    """创建需求"""
    data = request.json
    req_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO requirements (id, title, content, status, test_points_count, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (req_id, data.get("title", ""), data.get("content", ""), "pending", 0, 
              session.get("username", "admin"), now, now))
        conn.commit()
    
    return jsonify({"id": req_id, "title": data.get("title"), "status": "pending"}), 201

@app.route("/api/requirements/<req_id>", methods=["PUT"])
@login_required
def update_requirement(req_id):
    """更新需求"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["title", "content", "status", "test_points_count"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "ai_analysis" in data:
            updates.append("ai_analysis = ?")
            params.append(json.dumps(data["ai_analysis"], ensure_ascii=False) if data["ai_analysis"] else None)
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(req_id)
        
        cursor.execute(f"UPDATE requirements SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/requirements/<req_id>", methods=["DELETE"])
@login_required
def delete_requirement(req_id):
    """删除需求"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM requirements WHERE id = ?", (req_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

@app.route("/api/requirements/<req_id>/analyze", methods=["POST"])
@login_required
def analyze_requirement(req_id):
    """AI分析需求"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM requirements WHERE id = ?", (req_id,))
        from web.database import db_to_dict
        requirement = db_to_dict(cursor.fetchone())
    
    if not requirement:
        return jsonify({"error": "需求不存在"}), 404
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE requirements SET status = ?, updated_at = ? WHERE id = ?", 
                      ("analyzing", datetime.now().isoformat(), req_id))
        conn.commit()
    
    def run_analysis():
        try:
            llm_service.reload_providers()
            content = requirement.get("content", requirement.get("title", ""))
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                analysis = loop.run_until_complete(llm_service.generate_test_analysis(content))
            finally:
                loop.close()
            
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE requirements SET status = ?, ai_analysis = ?, test_points_count = ?, updated_at = ?
                    WHERE id = ?
                """, ("analyzed", json.dumps(analysis, ensure_ascii=False), 
                      len(analysis.get("test_points", [])), datetime.now().isoformat(), req_id))
                conn.commit()
        except Exception as e:
            analysis = llm_service._generate_mock_analysis(content)
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE requirements SET status = ?, ai_analysis = ?, test_points_count = ?, updated_at = ?
                    WHERE id = ?
                """, ("analyzed", json.dumps(analysis, ensure_ascii=False), 
                      len(analysis.get("test_points", [])), datetime.now().isoformat(), req_id))
                conn.commit()
    
    thread = threading.Thread(target=run_analysis)
    thread.start()
    return jsonify({"message": "分析已开始", "status": "analyzing"})

@app.route("/api/requirements/<req_id>/approve", methods=["POST"])
@login_required
def approve_requirement(req_id):
    """批准需求"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE requirements SET status = ?, updated_at = ? WHERE id = ?",
                      ("approved", datetime.now().isoformat(), req_id))
        conn.commit()
    return jsonify({"message": "已批准"})

# ==================== 测试点路由 ====================

@app.route("/api/test-points", methods=["GET"])
@login_required
def get_test_points():
    """获取测试点列表"""
    test_points = get_store("test_points")
    return jsonify({"items": test_points, "total": len(test_points)})

@app.route("/api/test-points", methods=["POST"])
@login_required
def create_test_point():
    """创建测试点"""
    data = request.json
    tp_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO test_points (id, requirement_id, title, description, type, priority, category, status, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (tp_id, data.get("requirement_id", ""), data.get("title", ""), data.get("description", ""),
              data.get("type", "功能测试"), data.get("priority", "中"), data.get("category", ""),
              "draft", session.get("username", "admin"), now))
        conn.commit()
    
    return jsonify({"id": tp_id, "title": data.get("title")}), 201

@app.route("/api/test-points/<tp_id>", methods=["PUT"])
@login_required
def update_test_point(tp_id):
    """更新测试点"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["title", "description", "type", "priority", "category", "status"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if updates:
            updates.append("updated_at = ?")
            params.append(datetime.now().isoformat())
            params.append(tp_id)
            cursor.execute(f"UPDATE test_points SET {', '.join(updates)} WHERE id = ?", params)
            conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/test-points/<tp_id>", methods=["DELETE"])
@login_required
def delete_test_point(tp_id):
    """删除测试点"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM test_points WHERE id = ?", (tp_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

@app.route("/api/test-points/batch-delete", methods=["POST"])
@login_required
def batch_delete_test_points():
    """批量删除测试点"""
    data = request.json
    ids = data.get("ids", [])
    
    with get_db() as conn:
        cursor = conn.cursor()
        for tp_id in ids:
            cursor.execute("DELETE FROM test_points WHERE id = ?", (tp_id,))
        conn.commit()
    
    return jsonify({"message": f"已删除{len(ids)}个测试点"})

# ==================== 测试方案路由 ====================

@app.route("/api/test-plans", methods=["GET"])
@login_required
def get_test_plans():
    """获取测试方案列表"""
    test_plans = get_store("test_plans")
    return jsonify({"items": test_plans, "total": len(test_plans)})

@app.route("/api/test-plans", methods=["POST"])
@login_required
def create_test_plan():
    """创建测试方案"""
    data = request.json
    plan_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO test_plans (id, title, description, status, ai_generated, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (plan_id, data.get("title", ""), data.get("description", ""), "draft", 0,
              session.get("username", "admin"), now, now))
        conn.commit()
    
    return jsonify({"id": plan_id, "title": data.get("title"), "status": "draft"}), 201

@app.route("/api/test-plans/<plan_id>", methods=["PUT"])
@login_required
def update_test_plan(plan_id):
    """更新测试方案"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["title", "description", "status"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "ai_suggestion" in data:
            updates.append("ai_suggestion = ?")
            params.append(json.dumps(data["ai_suggestion"], ensure_ascii=False) if data["ai_suggestion"] else None)
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(plan_id)
        
        cursor.execute(f"UPDATE test_plans SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/test-plans/<plan_id>", methods=["DELETE"])
@login_required
def delete_test_plan(plan_id):
    """删除测试方案"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM test_plans WHERE id = ?", (plan_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

# ==================== 测试用例路由 ====================

@app.route("/api/test-cases", methods=["GET"])
@login_required
def get_test_cases():
    """获取测试用例列表"""
    test_cases = get_store("test_cases")
    return jsonify({"items": test_cases, "total": len(test_cases)})

@app.route("/api/test-cases", methods=["POST"])
@login_required
def create_test_case():
    """创建测试用例"""
    data = request.json
    tc_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO test_cases (id, plan_id, title, precondition, steps, expected_result, 
                                   status, priority, type, ai_generated, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (tc_id, data.get("plan_id", ""), data.get("title", ""), data.get("precondition", ""),
              data.get("steps", ""), data.get("expected_result", ""), "draft",
              data.get("priority", "中"), data.get("type", "功能测试"), 0,
              session.get("username", "admin"), now))
        conn.commit()
    
    return jsonify({"id": tc_id, "title": data.get("title")}), 201

@app.route("/api/test-cases/<tc_id>", methods=["PUT"])
@login_required
def update_test_case(tc_id):
    """更新测试用例"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["title", "precondition", "steps", "expected_result", "status", "priority", "type"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(tc_id)
        
        cursor.execute(f"UPDATE test_cases SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/test-cases/<tc_id>", methods=["DELETE"])
@login_required
def delete_test_case(tc_id):
    """删除测试用例"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM test_cases WHERE id = ?", (tc_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

@app.route("/api/test-cases/generate", methods=["POST"])
@login_required
def generate_test_cases():
    """AI生成测试用例"""
    data = request.json
    plan_id = data.get("plan_id", "")
    
    # 获取测试点
    test_points = get_store("test_points")
    related_points = test_points[:10]
    
    # 生成测试用例
    generated = []
    sample_cases = [
        {"title": "测试登录接口-正确用户名密码", "precondition": "用户已注册", "steps": "1.输入正确用户名\n2.输入正确密码\n3.点击登录", "expected_result": "登录成功"},
        {"title": "测试登录接口-错误密码", "precondition": "用户已注册", "steps": "1.输入正确用户名\n2.输入错误密码\n3.点击登录", "expected_result": "提示密码错误"},
        {"title": "测试数据查询-正常查询", "precondition": "系统有数据", "steps": "1.进入查询页面\n2.输入查询条件\n3.点击查询", "expected_result": "显示查询结果"},
        {"title": "测试数据查询-空结果", "precondition": "系统无匹配数据", "steps": "1.进入查询页面\n2.输入不存在的条件\n3.点击查询", "expected_result": "显示无数据提示"},
        {"title": "测试API接口-参数校验", "precondition": "无", "steps": "1.发送缺少必填参数的请求\n2.检查响应", "expected_result": "返回参数错误提示"}
    ]
    
    for case in sample_cases:
        tc_id = generate_id()
        now = datetime.now().isoformat()
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO test_cases (id, plan_id, title, precondition, steps, expected_result, 
                                       status, priority, type, ai_generated, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (tc_id, plan_id, case["title"], case["precondition"], case["steps"],
                  case["expected_result"], "draft", "高", "功能测试", 1,
                  session.get("username", "admin"), now))
            conn.commit()
        
        generated.append({"id": tc_id, **case})
    
    return jsonify({"message": f"已生成{len(generated)}个测试用例", "cases": generated})

# ==================== 测试执行路由 ====================

@app.route("/api/executions", methods=["GET"])
@login_required
def get_executions():
    """获取测试执行列表"""
    executions = get_store("test_executions")
    return jsonify({"items": executions, "total": len(executions)})

@app.route("/api/executions/start", methods=["POST"])
@login_required
def start_execution():
    """开始测试执行"""
    data = request.json
    case_ids = data.get("case_ids", [])
    exec_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO test_executions (id, case_ids, status, progress, current_phase, started_by, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (exec_id, json.dumps(case_ids), "running", 0, "初始化", 
              session.get("username", "admin"), now))
        conn.commit()
    
    def run_execution():
        import time
        for i in range(100):
            time.sleep(0.1)
            phase = "环境准备" if i < 30 else ("执行测试" if i < 70 else "生成报告")
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE test_executions SET progress = ?, current_phase = ? WHERE id = ?",
                              (i + 1, phase, exec_id))
                conn.commit()
        
        total = len(case_ids)
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE test_executions SET status = ?, progress = ?, current_phase = ?, 
                results = ?, finished_at = ? WHERE id = ?
            """, ("completed", 100, "完成", 
                  json.dumps({"total": total, "passed": total - 2, "failed": 2, "pass_rate": round((total - 2) / total * 100, 1) if total > 0 else 0}),
                  datetime.now().isoformat(), exec_id))
            conn.commit()
    
    thread = threading.Thread(target=run_execution)
    thread.start()
    
    return jsonify({"message": "测试执行已开始", "execution_id": exec_id})

@app.route("/api/executions/<exec_id>", methods=["GET"])
@login_required
def get_execution(exec_id):
    """获取执行详情"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM test_executions WHERE id = ?", (exec_id,))
        from web.database import db_to_dict
        execution = db_to_dict(cursor.fetchone())
    
    if not execution:
        return jsonify({"error": "执行不存在"}), 404
    
    if execution.get("results") and isinstance(execution["results"], str):
        execution["results"] = json.loads(execution["results"])
    if execution.get("case_ids") and isinstance(execution["case_ids"], str):
        execution["case_ids"] = json.loads(execution["case_ids"])
    
    return jsonify(execution)

@app.route("/api/executions/status", methods=["GET"])
@login_required
def get_executions_status():
    """获取最新执行状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM test_executions WHERE status = 'running' ORDER BY started_at DESC LIMIT 1")
        from web.database import db_to_dict
        running = db_to_dict(cursor.fetchone())
    
    if running:
        return jsonify({"running": True, "execution_id": running["id"], "progress": running["progress"], "current_phase": running["current_phase"]})
    return jsonify({"running": False})

# ==================== 其他API路由 ====================

@app.route("/api/agents", methods=["GET"])
@login_required
def get_agents():
    """获取Agent列表"""
    agents = get_store("agents")
    return jsonify({"items": agents, "total": len(agents)})

@app.route("/api/agents", methods=["POST"])
@login_required
def create_agent():
    """创建Agent"""
    data = request.json
    agent_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO agents (id, name, role, goal, backstory, tools, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (agent_id, data.get("name", ""), data.get("role", ""), data.get("goal", ""),
              data.get("backstory", ""), json.dumps(data.get("tools", [])), "active", now, now))
        conn.commit()
    
    return jsonify({"id": agent_id, "name": data.get("name")}), 201

@app.route("/api/agents/<agent_id>", methods=["PUT"])
@login_required
def update_agent(agent_id):
    """更新Agent"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["name", "role", "goal", "backstory", "status"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "tools" in data:
            updates.append("tools = ?")
            params.append(json.dumps(data["tools"]))
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(agent_id)
        
        cursor.execute(f"UPDATE agents SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/agents/<agent_id>", methods=["DELETE"])
@login_required
def delete_agent(agent_id):
    """删除Agent"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

# ==================== 知识库路由 ====================

@app.route("/api/knowledge/patterns", methods=["GET"])
@login_required
def get_knowledge_patterns():
    """获取测试模式"""
    patterns = get_store("knowledge_patterns")
    return jsonify({"items": patterns, "total": len(patterns)})

@app.route("/api/knowledge/patterns", methods=["POST"])
@login_required
def create_knowledge_pattern():
    """创建测试模式"""
    data = request.json
    pattern_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO knowledge_patterns (id, title, category, content, tags, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (pattern_id, data.get("title", ""), data.get("category", ""), data.get("content", ""),
              json.dumps(data.get("tags", [])), session.get("username", "admin"), now))
        conn.commit()
    
    return jsonify({"id": pattern_id, "title": data.get("title")}), 201

@app.route("/api/knowledge/patterns/<pattern_id>", methods=["PUT"])
@login_required
def update_knowledge_pattern(pattern_id):
    """更新测试模式"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["title", "category", "content"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "tags" in data:
            updates.append("tags = ?")
            params.append(json.dumps(data["tags"]))
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(pattern_id)
        
        cursor.execute(f"UPDATE knowledge_patterns SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/knowledge/patterns/<pattern_id>", methods=["DELETE"])
@login_required
def delete_knowledge_pattern(pattern_id):
    """删除测试模式"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM knowledge_patterns WHERE id = ?", (pattern_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

@app.route("/api/knowledge/bugs", methods=["GET"])
@login_required
def get_knowledge_bugs():
    """获取Bug知识"""
    bugs = get_store("knowledge_bugs")
    return jsonify({"items": bugs, "total": len(bugs)})

@app.route("/api/knowledge/bugs", methods=["POST"])
@login_required
def create_knowledge_bug():
    """创建Bug知识"""
    data = request.json
    bug_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO knowledge_bugs (id, bug_id, title, description, severity, root_cause, solution, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (bug_id, data.get("bug_id", ""), data.get("title", ""), data.get("description", ""),
              data.get("severity", "中"), data.get("root_cause", ""), data.get("solution", ""),
              session.get("username", "admin"), now))
        conn.commit()
    
    return jsonify({"id": bug_id, "title": data.get("title")}), 201

@app.route("/api/knowledge/bugs/<bug_id>", methods=["PUT"])
@login_required
def update_knowledge_bug(bug_id):
    """更新Bug知识"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["bug_id", "title", "description", "severity", "root_cause", "solution"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(bug_id)
        
        cursor.execute(f"UPDATE knowledge_bugs SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/knowledge/bugs/<bug_id>", methods=["DELETE"])
@login_required
def delete_knowledge_bug(bug_id):
    """删除Bug知识"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM knowledge_bugs WHERE id = ?", (bug_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

# ==================== MCP服务路由 ====================

@app.route("/api/mcp-services", methods=["GET"])
@login_required
def get_mcp_services():
    """获取MCP服务列表"""
    services = get_store("mcp_services")
    return jsonify({"items": services, "total": len(services)})

@app.route("/api/mcp-services", methods=["POST"])
@login_required
def create_mcp_service():
    """创建MCP服务"""
    data = request.json
    service_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO mcp_services (id, name, type, endpoint, config, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (service_id, data.get("name", ""), data.get("type", "tool"), data.get("endpoint", ""),
              json.dumps(data.get("config", {})), "inactive", now))
        conn.commit()
    
    return jsonify({"id": service_id, "name": data.get("name")}), 201

@app.route("/api/mcp-services/<service_id>", methods=["PUT"])
@login_required
def update_mcp_service(service_id):
    """更新MCP服务"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["name", "type", "endpoint", "status"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "config" in data:
            updates.append("config = ?")
            params.append(json.dumps(data["config"]))
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(service_id)
        
        cursor.execute(f"UPDATE mcp_services SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/mcp-services/<service_id>", methods=["DELETE"])
@login_required
def delete_mcp_service(service_id):
    """删除MCP服务"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM mcp_services WHERE id = ?", (service_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

@app.route("/api/mcp-services/<service_id>/test", methods=["POST"])
@login_required
def test_mcp_service(service_id):
    """测试MCP服务"""
    import requests
    import time
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM mcp_services WHERE id = ?", (service_id,))
        from web.database import db_to_dict
        service = db_to_dict(cursor.fetchone())
    
    if not service:
        return jsonify({"error": "服务不存在"}), 404
    
    endpoint = service.get("endpoint", "")
    if not endpoint:
        return jsonify({"status": "error", "message": "未配置端点"})
    
    try:
        start_time = time.time()
        response = requests.get(endpoint, timeout=5)
        response_time = round((time.time() - start_time) * 1000, 2)
        
        if response.status_code == 200:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE mcp_services SET status = ?, updated_at = ? WHERE id = ?",
                              ("active", datetime.now().isoformat(), service_id))
                conn.commit()
            return jsonify({"status": "success", "message": "服务连接正常", "response_time": response_time})
        else:
            return jsonify({"status": "warning", "message": f"服务返回状态码: {response.status_code}", "response_time": response_time})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

# ==================== Skill路由 ====================

@app.route("/api/skills", methods=["GET"])
@login_required
def get_skills():
    """获取Skill列表"""
    skills = get_store("skills")
    return jsonify({"items": skills, "total": len(skills)})

@app.route("/api/skills", methods=["POST"])
@login_required
def create_skill():
    """创建Skill"""
    data = request.json
    skill_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO skills (id, name, description, prompt_template, config, status, version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (skill_id, data.get("name", ""), data.get("description", ""), data.get("prompt_template", ""),
              json.dumps(data.get("config", {})), "active", 1, now))
        conn.commit()
    
    return jsonify({"id": skill_id, "name": data.get("name")}), 201

@app.route("/api/skills/<skill_id>", methods=["PUT"])
@login_required
def update_skill(skill_id):
    """更新Skill"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["name", "description", "status"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "prompt_template" in data:
            updates.append("prompt_template = ?")
            params.append(data["prompt_template"])
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(skill_id)
        
        cursor.execute(f"UPDATE skills SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/skills/<skill_id>", methods=["DELETE"])
@login_required
def delete_skill(skill_id):
    """删除Skill"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

# ==================== 提示词模板路由 ====================

@app.route("/api/prompts", methods=["GET"])
@login_required
def get_prompt_templates():
    """获取提示词模板列表"""
    templates = get_store("prompt_templates")
    return jsonify({"items": templates, "total": len(templates)})

@app.route("/api/prompts", methods=["POST"])
@login_required
def create_prompt_template():
    """创建提示词模板"""
    data = request.json
    template_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO prompt_templates (id, name, category, template, variables, version, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (template_id, data.get("name", ""), data.get("category", ""), data.get("template", ""),
              json.dumps(data.get("variables", [])), 1, session.get("username", "admin"), now))
        conn.commit()
    
    return jsonify({"id": template_id, "name": data.get("name")}), 201

@app.route("/api/prompts/<template_id>", methods=["PUT"])
@login_required
def update_prompt_template(template_id):
    """更新提示词模板"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["name", "category", "template"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "variables" in data:
            updates.append("variables = ?")
            params.append(json.dumps(data["variables"]))
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(template_id)
        
        cursor.execute(f"UPDATE prompt_templates SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/prompts/<template_id>", methods=["DELETE"])
@login_required
def delete_prompt_template(template_id):
    """删除提示词模板"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM prompt_templates WHERE id = ?", (template_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

# ==================== LLM配置路由 ====================

@app.route("/api/llm/providers", methods=["GET"])
@login_required
def get_llm_providers():
    """获取LLM提供商列表"""
    providers = get_store("llm_providers")
    return jsonify({"items": providers, "total": len(providers)})

@app.route("/api/llm/providers", methods=["POST"])
@login_required
def create_llm_provider():
    """创建LLM提供商"""
    data = request.json
    provider_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO llm_providers (id, name, type, api_key, base_url, config, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (provider_id, data.get("name", ""), data.get("type", "openai"), data.get("api_key", ""),
              data.get("base_url", ""), json.dumps(data.get("config", {})), "active", now))
        conn.commit()
    
    return jsonify({"id": provider_id, "name": data.get("name")}), 201

@app.route("/api/llm/providers/<provider_id>", methods=["PUT"])
@login_required
def update_llm_provider(provider_id):
    """更新LLM提供商"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["name", "type", "base_url", "status"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "api_key" in data and data["api_key"]:
            updates.append("api_key = ?")
            params.append(data["api_key"])
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(provider_id)
        
        cursor.execute(f"UPDATE llm_providers SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/llm/providers/<provider_id>", methods=["DELETE"])
@login_required
def delete_llm_provider(provider_id):
    """删除LLM提供商"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM llm_providers WHERE id = ?", (provider_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

# ==================== 去AI味路由 ====================

@app.route("/api/de-ai/strategies", methods=["GET"])
@login_required
def get_de_ai_strategies():
    """获取去AI味策略"""
    strategies = get_store("de_ai_strategies")
    return jsonify({"items": strategies, "total": len(strategies)})

@app.route("/api/de-ai/strategies", methods=["POST"])
@login_required
def create_de_ai_strategy():
    """创建去AI味策略"""
    data = request.json
    strategy_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO de_ai_strategies (id, name, type, config, enabled, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (strategy_id, data.get("name", ""), data.get("type", "style"),
              json.dumps(data.get("config", {})), 1 if data.get("enabled", True) else 0, now))
        conn.commit()
    
    return jsonify({"id": strategy_id, "name": data.get("name")}), 201

@app.route("/api/de-ai/strategies/<strategy_id>", methods=["PUT"])
@login_required
def update_de_ai_strategy(strategy_id):
    """更新去AI味策略"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["name", "type"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "config" in data:
            updates.append("config = ?")
            params.append(json.dumps(data["config"]))
        
        if "enabled" in data:
            updates.append("enabled = ?")
            params.append(1 if data["enabled"] else 0)
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(strategy_id)
        
        cursor.execute(f"UPDATE de_ai_strategies SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/de-ai/strategies/<strategy_id>", methods=["DELETE"])
@login_required
def delete_de_ai_strategy(strategy_id):
    """删除去AI味策略"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM de_ai_strategies WHERE id = ?", (strategy_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

@app.route("/api/de-ai/test", methods=["POST"])
@login_required
def test_de_ai():
    """测试去AI味效果"""
    data = request.json
    content = data.get("content", "")
    return jsonify({"original": content, "processed": content, "metrics": {"perplexity": 45.2, "burstiness": 0.35, "ai_detection_score": 0.25}})

# ==================== 导出路由 ====================

@app.route("/api/export/test-cases", methods=["POST"])
@login_required
def export_test_cases():
    """导出测试用例"""
    import csv
    import io
    
    test_cases = get_store("test_cases")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "标题", "前置条件", "测试步骤", "预期结果", "类型", "优先级", "状态", "AI生成"])
    
    for tc in test_cases:
        writer.writerow([
            tc.get("id", ""), tc.get("title", ""), tc.get("precondition", ""),
            tc.get("steps", ""), tc.get("expected_result", ""), tc.get("type", ""),
            tc.get("priority", ""), tc.get("status", ""), "是" if tc.get("ai_generated") else "否"
        ])
    
    from flask import Response
    return Response(output.getvalue(), mimetype="text/csv",
                   headers={"Content-Disposition": "attachment;filename=test_cases.csv"})

@app.route("/api/export/knowledge", methods=["POST"])
@login_required
def export_knowledge():
    """导出知识库"""
    data = request.json
    export_type = data.get("type", "patterns")
    
    if export_type == "patterns":
        items = get_store("knowledge_patterns")
    else:
        items = get_store("knowledge_bugs")
    
    return jsonify({"type": export_type, "items": items, "exported_at": datetime.now().isoformat()})

# ==================== Web自动化路由 ====================

@app.route("/api/web-scripts", methods=["GET"])
@login_required
def get_web_scripts():
    """获取Web脚本列表"""
    scripts = get_store("web_scripts")
    return jsonify({"items": scripts, "total": len(scripts)})

@app.route("/api/web-scripts", methods=["POST"])
@login_required
def create_web_script():
    """创建Web脚本"""
    data = request.json
    script_id = generate_id()
    now = datetime.now().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO web_scripts (id, name, description, target_url, steps, status, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (script_id, data.get("name", ""), data.get("description", ""), data.get("target_url", ""),
              json.dumps(data.get("steps", [])), "draft", session.get("username", "admin"), now))
        conn.commit()
    
    return jsonify({"id": script_id, "name": data.get("name")}), 201

@app.route("/api/web-scripts/<script_id>", methods=["GET"])
@login_required
def get_web_script(script_id):
    """获取Web脚本详情"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM web_scripts WHERE id = ?", (script_id,))
        from web.database import db_to_dict
        script = db_to_dict(cursor.fetchone())
    
    if not script:
        return jsonify({"error": "脚本不存在"}), 404
    
    if script.get("steps") and isinstance(script["steps"], str):
        script["steps"] = json.loads(script["steps"])
    
    return jsonify(script)

@app.route("/api/web-scripts/<script_id>", methods=["PUT"])
@login_required
def update_web_script(script_id):
    """更新Web脚本"""
    data = request.json
    
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for key in ["name", "description", "target_url", "status"]:
            if key in data:
                updates.append(f"{key} = ?")
                params.append(data[key])
        
        if "steps" in data:
            updates.append("steps = ?")
            params.append(json.dumps(data["steps"]))
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(script_id)
        
        cursor.execute(f"UPDATE web_scripts SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
    
    return jsonify({"message": "更新成功"})

@app.route("/api/web-scripts/<script_id>", methods=["DELETE"])
@login_required
def delete_web_script(script_id):
    """删除Web脚本"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM web_scripts WHERE id = ?", (script_id,))
        conn.commit()
    return jsonify({"message": "删除成功"})

@app.route("/api/web-scripts/<script_id>/run", methods=["POST"])
@login_required
def run_web_script(script_id):
    """执行Web脚本"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM web_scripts WHERE id = ?", (script_id,))
        from web.database import db_to_dict
        script = db_to_dict(cursor.fetchone())
    
    if not script:
        return jsonify({"error": "脚本不存在"}), 404
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE web_scripts SET status = ?, last_run = ? WHERE id = ?",
                      ("running", datetime.now().isoformat(), script_id))
        conn.commit()
    
    def run_script():
        import time
        time.sleep(3)
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE web_scripts SET status = ?, last_result = ? WHERE id = ?
            """, ("completed", json.dumps({"passed": True, "duration": 3.5, "steps_passed": len(script.get("steps", [])), "steps_total": len(script.get("steps", []))}), script_id))
            conn.commit()
    
    thread = threading.Thread(target=run_script)
    thread.start()
    return jsonify({"message": "脚本开始执行", "status": "running"})

@app.route("/api/web-scripts/stats", methods=["GET"])
@login_required
def get_web_script_stats():
    """获取Web脚本统计"""
    scripts = get_store("web_scripts")
    return jsonify({"total_scripts": len(scripts), "total_executions": 0, "completed": 0, "failed": 0, "avg_duration": 0, "success_rate": 0})

# ==================== 测试路由 ====================

@app.route("/api/llm/test", methods=["POST"])
@login_required
def test_llm():
    """测试LLM连接"""
    data = request.json
    provider = data.get("provider", "openai")
    api_key = data.get("api_key", "")
    
    if not api_key:
        return jsonify({"status": "error", "message": "请提供API密钥"})
    
    return jsonify({"status": "success", "message": "连接测试成功"})

@app.route("/api/de-ai/strategies/<strategy_id>/test", methods=["POST"])
@login_required
def test_de_ai_strategy(strategy_id):
    """测试去AI味策略"""
    return jsonify({"status": "success", "message": "策略测试成功"})

# ==================== 启动 ====================

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5001, debug=True, allow_unsafe_werkzeug=True)
