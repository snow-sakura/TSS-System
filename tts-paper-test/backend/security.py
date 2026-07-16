"""安全模块 - CSRF防护、输入验证、XSS防护"""

import secrets
import html
import re
from functools import wraps
from flask import request, session, abort


# CSRF Token存储
csrf_tokens = {}


def generate_csrf_token():
    """生成CSRF Token"""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


def validate_csrf_token(token):
    """验证CSRF Token"""
    return token == session.get('csrf_token')


def csrf_protect(f):
    """CSRF保护装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method in ['POST', 'PUT', 'DELETE']:
            token = request.form.get('csrf_token') or request.headers.get('X-CSRF-Token')
            if not validate_csrf_token(token):
                abort(403, description="CSRF token无效")
        return f(*args, **kwargs)
    return decorated_function


def sanitize_input(text):
    """输入清理 - 防止XSS"""
    if text is None:
        return None
    # 转义HTML特殊字符
    return html.escape(str(text))


def validate_email(email):
    """验证邮箱格式"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_url(url):
    """验证URL格式"""
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    return bool(re.match(pattern, url))


def validate_json(text):
    """验证JSON格式"""
    import json
    try:
        json.loads(text)
        return True
    except json.JSONDecodeError:
        return False


def limit_request_size(max_size=16 * 1024 * 1024):
    """限制请求大小"""
    if request.content_length and request.content_length > max_size:
        abort(413, description="请求体过大")


def secure_headers():
    """添加安全响应头"""
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'"
    }


def password_strength_check(password):
    """密码强度检查"""
    if len(password) < 8:
        return False, "密码长度至少8位"
    if not re.search(r'[A-Z]', password):
        return False, "密码需包含大写字母"
    if not re.search(r'[a-z]', password):
        return False, "密码需包含小写字母"
    if not re.search(r'\d', password):
        return False, "密码需包含数字"
    return True, "密码强度合格"


def log_security_event(event_type, details):
    """记录安全事件"""
    from datetime import datetime
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "details": details,
        "ip": request.remote_addr if request else "unknown"
    }
    # 这里可以将日志写入文件或数据库
    print(f"[SECURITY] {event_type}: {details}")
