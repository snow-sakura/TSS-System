"""速率限制模块"""

import time
from collections import defaultdict
from functools import wraps
from flask import request, jsonify


class RateLimiter:
    """速率限制器"""
    
    def __init__(self):
        self._requests = defaultdict(list)
    
    def is_rate_limited(self, key, max_requests=10, window=60):
        """
        检查是否被速率限制
        
        Args:
            key: 限制键（如IP地址或用户ID）
            max_requests: 窗口期内最大请求数
            window: 时间窗口（秒）
        
        Returns:
            bool: 是否被限制
        """
        now = time.time()
        
        # 清理过期记录
        self._requests[key] = [
            t for t in self._requests[key] if now - t < window
        ]
        
        # 检查请求数
        if len(self._requests[key]) >= max_requests:
            return True
        
        # 记录当前请求
        self._requests[key].append(now)
        return False
    
    def get_remaining(self, key, max_requests=10, window=60):
        """获取剩余请求数"""
        now = time.time()
        self._requests[key] = [
            t for t in self._requests[key] if now - t < window
        ]
        return max(0, max_requests - len(self._requests[key]))


# 全局速率限制器
rate_limiter = RateLimiter()


def rate_limit(max_requests=10, window=60):
    """速率限制装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # 使用IP地址作为限制键
            key = f"{request.remote_addr}:{f.__name__}"
            
            if rate_limiter.is_rate_limited(key, max_requests, window):
                return jsonify({
                    "error": "请求过于频繁，请稍后再试",
                    "retry_after": window
                }), 429
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def login_rate_limit(f):
    """登录速率限制装饰器 - 更严格的限制"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        key = f"login:{request.remote_addr}"
        
        if rate_limiter.is_rate_limited(key, max_requests=5, window=300):  # 5分钟内最多5次
            log_security_event("RATE_LIMITED", {
                "endpoint": "login",
                "ip": request.remote_addr
            })
            return jsonify({
                "error": "登录尝试次数过多，请5分钟后再试"
            }), 429
        
        return f(*args, **kwargs)
    return decorated_function


from web.security import log_security_event
