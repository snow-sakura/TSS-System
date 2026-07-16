/**
 * TSS AI测试平台 - API客户端模块
 */

// 请求缓存
const requestCache = new Map();
const CACHE_TTL = 30000; // 30秒

const api = {
  async get(url, useCache = false) {
    if (useCache && requestCache.has(url)) {
      const cached = requestCache.get(url);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (useCache) requestCache.set(url, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('GET请求失败:', url, error);
      throw error;
    }
  },

  async post(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('POST请求失败:', url, error);
      throw error;
    }
  },

  async put(url, data) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('PUT请求失败:', url, error);
      throw error;
    }
  },

  async delete(url) {
    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('DELETE请求失败:', url, error);
      throw error;
    }
  },

  clearCache() { requestCache.clear(); },
  clearCacheFor(url) { requestCache.delete(url); }
};

// 暴露到全局（兼容旧代码）
window.api = api;
