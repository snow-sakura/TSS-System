/**
 * TSS AI测试平台 - 工具函数模块
 */

const Utils = {
  // 格式化日期
  formatDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  },

  // 格式化短日期
  formatShortDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' });
  },

  // 状态标签HTML
  statusBadge(status) {
    const labels = {
      'pending': '待处理', 'running': '执行中', 'completed': '已完成',
      'failed': '失败', 'draft': '草稿', 'active': '活跃', 'inactive': '未激活',
      'analyzing': '分析中', 'analyzed': '已分析', 'approved': '已批准',
      'rejected': '已拒绝', 'generating': '生成中', 'generated': '已生成'
    };
    return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
  },

  // HTML转义
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // 生成唯一ID（简单版）
  genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  // 深拷贝
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // 延迟
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// 向后兼容
window.formatDate = (d) => Utils.formatDate(d);
window.getStatusBadge = (s) => Utils.statusBadge(s);
window.escapeHtml = (t) => Utils.escapeHtml(t);
