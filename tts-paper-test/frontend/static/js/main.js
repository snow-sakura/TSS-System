/**
 * TSS AI测试平台 - 主入口
 */

document.addEventListener('DOMContentLoaded', function() {
  // 初始化侧边栏折叠
  initSidebar();

  // 绑定模态框关闭
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = this.closest('.modal-overlay');
      if (modal) modal.classList.add('hidden');
    });
  });

  // 点击遮罩关闭模态框
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) this.classList.add('hidden');
    });
  });

  // 页面切换加载效果
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript') && !href.startsWith('http')) {
      link.addEventListener('click', function() {
        document.body.classList.add('page-transitioning');
      });
    }
  });
});

// 侧边栏折叠
function initSidebar() {
  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      if (mainContent) mainContent.classList.toggle('sidebar-collapsed');
      localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    });

    // 恢复上次状态
    if (localStorage.getItem('sidebar_collapsed') === 'true') {
      sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('sidebar-collapsed');
    }
  }

  // 移动端侧边栏
  const mobileToggle = document.getElementById('mobileSidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      if (overlay) overlay.classList.remove('hidden');
    });
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        overlay.classList.add('hidden');
      });
    }
  }
}

// 页面加载完成
window.addEventListener('load', function() {
  document.body.classList.remove('page-transitioning');
});
