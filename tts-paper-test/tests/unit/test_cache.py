"""缓存模块单元测试"""

import pytest
import time
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from web.cache import MemoryCache, cache


def test_cache_set_get():
    """测试设置和获取缓存"""
    test_cache = MemoryCache(default_ttl=60)
    
    test_cache.set("key1", "value1")
    result = test_cache.get("key1")
    
    assert result == "value1"


def test_cache_not_found():
    """测试获取不存在的缓存"""
    test_cache = MemoryCache()
    
    result = test_cache.get("nonexistent")
    
    assert result is None


def test_cache_expiration():
    """测试缓存过期"""
    test_cache = MemoryCache(default_ttl=1)
    
    test_cache.set("key1", "value1", ttl=1)
    assert test_cache.get("key1") == "value1"
    
    time.sleep(1.1)
    
    result = test_cache.get("key1")
    assert result is None


def test_cache_delete():
    """测试删除缓存"""
    test_cache = MemoryCache()
    
    test_cache.set("key1", "value1")
    assert test_cache.get("key1") == "value1"
    
    test_cache.delete("key1")
    assert test_cache.get("key1") is None


def test_cache_clear():
    """测试清空缓存"""
    test_cache = MemoryCache()
    
    test_cache.set("key1", "value1")
    test_cache.set("key2", "value2")
    
    test_cache.clear()
    
    assert test_cache.get("key1") is None
    assert test_cache.get("key2") is None


def test_cache_cleanup():
    """测试清理过期缓存"""
    test_cache = MemoryCache()
    
    test_cache.set("key1", "value1", ttl=1)
    test_cache.set("key2", "value2", ttl=60)
    
    time.sleep(1.1)
    test_cache.cleanup()
    
    assert test_cache.get("key1") is None
    assert test_cache.get("key2") == "value2"


def test_cache_get_or_set():
    """测试获取或设置缓存"""
    test_cache = MemoryCache()
    
    # 第一次调用，应该调用工厂函数
    call_count = 0
    def factory():
        nonlocal call_count
        call_count += 1
        return "computed_value"
    
    result = test_cache.get_or_set("key1", factory)
    assert result == "computed_value"
    assert call_count == 1
    
    # 第二次调用，应该使用缓存
    result = test_cache.get_or_set("key1", factory)
    assert result == "computed_value"
    assert call_count == 1  # 工厂函数没有被再次调用


def test_global_cache():
    """测试全局缓存实例"""
    assert cache is not None
    assert isinstance(cache, MemoryCache)
