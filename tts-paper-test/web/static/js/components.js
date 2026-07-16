/**
 * TSS AI测试平台 - UI组件模块
 */

const Components = {
  // ========== Toast通知 ==========
  toast(message, type = 'info', duration = 3500) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ========== 模态框 ==========
  modal: {
    show(id) {
      const el = document.getElementById(id) || document.querySelector(`[data-modal="${id}"]`);
      if (el) {
        el.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
    },
    hide(id) {
      const el = document.getElementById(id) || document.querySelector(`[data-modal="${id}"]`);
      if (el) {
        el.classList.add('hidden');
        document.body.style.overflow = '';
      }
    },
    create(content, options = {}) {
      const id = options.id || 'dynamic-modal-' + Date.now();
      const modal = document.createElement('div');
      modal.className = 'modal-overlay hidden';
      modal.id = id;
      modal.innerHTML = `
        <div class="modal-content ${options.size || ''}">
          <div class="modal-header">
            <h3>${options.title || ''}</h3>
            <button class="modal-close" onclick="Components.modal.hide('${id}')">&times;</button>
          </div>
          <div class="modal-body">${content}</div>
          ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
        </div>
      `;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) Components.modal.hide(id);
      });
      document.body.appendChild(modal);
      return id;
    }
  },

  // ========== 确认对话框 ==========
  confirm(message, title = '确认操作') {
    return new Promise((resolve) => {
      const id = Components.modal.create(
        `<p class="text-sm" style="color: var(--color-text-secondary)">${message}</p>`,
        {
          title,
          size: '',
          footer: `
            <button class="btn btn-outline" onclick="Components.modal.hide('${id}')">取消</button>
            <button class="btn btn-danger" id="confirm-yes-${id}">确认</button>
          `
        }
      );
      Components.modal.show(id);
      document.getElementById(`confirm-yes-${id}`).addEventListener('click', () => {
        Components.modal.hide(id);
        resolve(true);
      });
    });
  },

  // ========== 表格渲染 ==========
  renderTable(tbodyId, items, columns, emptyMessage = '暂无数据') {
    const tbody = document.getElementById(tbodyId);
    const emptyEl = document.getElementById('emptyState');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    tbody.innerHTML = items.map(item => {
      const row = document.createElement('tr');
      let html = '';
      columns.forEach(col => {
        if (col.render) {
          html += `<td class="${col.className || ''}">${col.render(item)}</td>`;
        } else {
          const val = item[col.key] ?? '-';
          html += `<td class="${col.className || ''}">${val}</td>`;
        }
      });
      return `<tr>${html}</tr>`;
    }).join('');
  },

  // ========== 分页 ==========
  renderPagination(containerId, current, total, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (total <= 1) { container.innerHTML = ''; return; }

    let html = '';
    const prevDisabled = current <= 1;
    const nextDisabled = current >= total;

    html += `<button class="page-btn" ${prevDisabled ? 'disabled' : ''} onclick="(${callback})(${current - 1})"><i class="fas fa-chevron-left"></i></button>`;

    const range = (start, end) => {
      for (let i = start; i <= end; i++) {
        if (i === current - 2 || i === current + 2) {
          html += '<span class="page-ellipsis">…</span>';
        }
        if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
          html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="(${callback})(${i})">${i}</button>`;
        }
      }
    };
    range(1, total);

    html += `<button class="page-btn" ${nextDisabled ? 'disabled' : ''} onclick="(${callback})(${current + 1})"><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
  }
};

// 向后兼容
window.showAlert = (msg, type = 'info') => Components.toast(msg, type);
window.showModal = (id) => Components.modal.show(id);
window.hideModal = (id) => Components.modal.hide(id);
window.confirmAction = (msg) => Components.confirm(msg);
