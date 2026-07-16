"""前端路由模块 - 处理页面路由"""

from flask import Blueprint, render_template, session, redirect, url_for

frontend_bp = Blueprint('frontend', __name__)


def login_required(f):
    """登录验证装饰器"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("frontend.login"))
        return f(*args, **kwargs)
    return decorated_function


@frontend_bp.route("/login", methods=["GET", "POST"])
def login():
    """登录页面"""
    from flask import request
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        
        from web.database import get_db, db_to_dict, hash_password
        from web.security import log_security_event
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ? AND status = 'active'", (username,))
            user = db_to_dict(cursor.fetchone())
        
        if user and user["password_hash"] == hash_password(password):
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["role"] = user["role"]
            log_security_event("LOGIN_SUCCESS", {"username": username})
            return redirect(url_for("frontend.index"))
        
        log_security_event("LOGIN_FAILED", {"username": username})
        return render_template("login.html", error="用户名或密码错误")
    return render_template("login.html")


@frontend_bp.route("/logout")
def logout():
    """退出登录"""
    session.clear()
    return redirect(url_for("frontend.login"))


@frontend_bp.route("/")
@login_required
def index():
    """仪表盘首页"""
    from web.app import get_store
    stats = {
        "requirements_count": len(get_store("requirements")),
        "test_points_count": len(get_store("test_points")),
        "test_plans_count": len(get_store("test_plans")),
        "test_cases_count": len(get_store("test_cases")),
        "executions_count": len(get_store("test_executions")),
        "agents_count": len(get_store("agents"))
    }
    return render_template("dashboard.html", stats=stats)


@frontend_bp.route("/requirements")
@login_required
def requirements_page():
    """需求分析页面"""
    return render_template("requirements.html")


@frontend_bp.route("/test-points")
@login_required
def test_points_page():
    """测试点管理页面"""
    return render_template("test_points.html")


@frontend_bp.route("/test-plans")
@login_required
def test_plans_page():
    """测试方案页面"""
    return render_template("test_plans.html")


@frontend_bp.route("/test-cases")
@login_required
def test_cases_page():
    """测试用例页面"""
    return render_template("test_cases.html")


@frontend_bp.route("/executions")
@login_required
def executions_page():
    """测试执行页面"""
    return render_template("executions.html")


@frontend_bp.route("/reports")
@login_required
def reports_page():
    """分析报告页面"""
    return render_template("reports.html")


@frontend_bp.route("/web-automation")
@login_required
def web_automation_page():
    """Web自动化测试页面"""
    return render_template("web_automation.html")


@frontend_bp.route("/api-testing")
@login_required
def api_testing_page():
    """API测试页面"""
    return render_template("api_testing.html")


@frontend_bp.route("/performance-testing")
@login_required
def performance_testing_page():
    """性能测试页面"""
    return render_template("performance_testing.html")


@frontend_bp.route("/knowledge")
@login_required
def knowledge_page():
    """知识库页面"""
    return render_template("knowledge.html")


@frontend_bp.route("/agents")
@login_required
def agents_page():
    """Agent配置页面"""
    return render_template("agents.html")


@frontend_bp.route("/mcp-services")
@login_required
def mcp_services_page():
    """MCP服务页面"""
    return render_template("mcp_services.html")


@frontend_bp.route("/skills")
@login_required
def skills_page():
    """Skill配置页面"""
    return render_template("skills.html")


@frontend_bp.route("/prompts")
@login_required
def prompts_page():
    """提示词工程页面"""
    return render_template("prompts.html")


@frontend_bp.route("/llm")
@login_required
def llm_page():
    """大模型配置页面"""
    return render_template("llm.html")


@frontend_bp.route("/de-ai")
@login_required
def de_ai_page():
    """去AI味页面"""
    return render_template("de_ai.html")


@frontend_bp.route("/users")
@login_required
def users_page():
    """用户管理页面"""
    return render_template("users.html")


@frontend_bp.route("/settings")
@login_required
def settings_page():
    """系统设置页面"""
    return render_template("settings.html")
