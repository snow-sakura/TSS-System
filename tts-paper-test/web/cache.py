"""缓存模块 - 内存缓存"""

import time
from typing import Any, Optional
from functools import wraps


class MemoryCache:
    """内存缓存类"""
    
    def __init__(self, default_ttl: int = 300):
        """
        初始化缓存
        
        Args:
            default_ttl: 默认过期时间（秒）
        """
        self._cache = {}
        self._default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        if key in self._cache:
            item = self._cache[key]
            if item["expires_at"] > time.time():
                return item["value"]
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """设置缓存值"""
        if ttl is None:
            ttl = self._default_ttl
        self._cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl
        }
    
    def delete(self, key: str):
        """删除缓存"""
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        """清空缓存"""
        self._cache.clear()
    
    def cleanup(self):
        """清理过期缓存"""
        now = time.time()
        expired_keys = [k for k, v in self._cache.items() if v["expires_at"] <= now]
        for key in expired_keys:
            del self._cache[key]
    
    def get_or_set(self, key: str, factory, ttl: Optional[int] = None) -> Any:
        """获取缓存值，如果不存在则调用工厂函数生成"""
        value = self.get(key)
        if value is not None:
            return value
        value = factory()
        self.set(key, value, ttl)
        return value


# 全局缓存实例
cache = MemoryCache(default_ttl=300)  # 默认5分钟过期


def cached(ttl: Optional[int] = None, key_prefix: str = ""):
    """缓存装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{key_prefix}{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # 尝试获取缓存
            result = cache.get(cache_key)
            if result is not None:
                return result
            
            # 调用函数
            result = func(*args, **kwargs)
            
            # 缓存结果
            cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


# 定期清理过期缓存
def start_cache_cleanup():
    """启动缓存清理任务"""
    import threading
    
    def cleanup_task():
        while True:
            time.sleep(60)  # 每分钟清理一次
            cache.cleanup()
    
    thread = threading.Thread(target=cleanup_task, daemon=True)
    thread.start()


# 启动缓存清理
start_cache_cleanup()
