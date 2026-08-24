// orders.js – Admin Orders Manager (Firebase v9)
// All order fields editable from the modal

import { db } from '../firebase.js';
import {
  collection, onSnapshot, doc,
  updateDoc, deleteDoc, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* -------------------------------------------------- */
/* TOAST                                              */
/* -------------------------------------------------- */

function toast(msg, type = 'success', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:28px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.style.cssText = `
    padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;
    opacity:0;transform:translateY(12px);
    transition:opacity .3s ease,transform .3s ease;
    pointer-events:none;max-width:320px;
    ${type === 'success' ? 'background:rgba(48,209,88,0.18);border:1px solid rgba(48,209,88,0.4);color:#30D158;' :
      type === 'error'   ? 'background:rgba(255,69,58,0.18);border:1px solid rgba(255,69,58,0.4);color:#FF453A;' :
                           'background:rgba(10,132,255,0.18);border:1px solid rgba(10,132,255,0.4);color:#0A84FF;'}
  `;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
  }));
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateY(12px)';
    setTimeout(() => el.remove(), 350);
  }, duration);
}

/* -------------------------------------------------- */
/* HELPERS                                            */
/* -------------------------------------------------- */

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d.toDate ? d.toDate() : d).toLocaleString(); } catch { return d; }
}

const STATUS_COLORS = {
  'Pending':          '#FF9F0A',
  'In Progress':      '#0A84FF',
  'Review':           '#BF5AF2',
  'Completed':        '#30D158',
  'Cancelled':        '#FF453A',
  'Awaiting Deposit': '#FF9F0A',
  'Deposit Received': '#0A84FF',
  'Advance Paid':     '#60a5fa',
  'Paid':             '#30D158',
  'Refunded':         '#FF453A',
};

function badge(text, fallbackColor = '#88889a') {
  const c = STATUS_COLORS[text] || fallbackColor;
  return `<span style="
    display:inline-flex;align-items:center;padding:3px 10px;
    border-radius:999px;font-size:12px;font-weight:600;
    background:${c}22;border:1px solid ${c}55;color:${c};">
    ${text}
  </span>`;
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

/* -------------------------------------------------- */
/* MODAL FIELD BUILDERS                               */
/* -------------------------------------------------- */

function editSelect(id, label, options, current) {
  return `<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#88889a;">${label}
    <select id="${id}" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:10px;padding:10px 12px;color:#f0f0f5;font-size:14px;font-family:inherit;">
      ${options.map(o => `<option ${o === current ? 'selected' : ''}>${o}</option>`).join('')}
    </select>
  </label>`;
}

function editInput(id, label, placeholder, type = 'text', value = '') {
  return `<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#88889a;">${label}
    <input id="${id}" type="${type}" placeholder="${placeholder}" value="${value || ''}"
      style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:10px;padding:10px 12px;color:#f0f0f5;font-size:14px;font-family:inherit;width:100%;box-sizing:border-box;${type==='date'?'color-scheme:dark;':''}">
  </label>`;
}

function editTextarea(id, label, placeholder, value = '') {
  return `<label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#88889a;">${label}
    <textarea id="${id}" placeholder="${placeholder}" rows="3"
      style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:10px;padding:10px 12px;color:#f0f0f5;font-size:14px;font-family:inherit;width:100%;resize:vertical;box-sizing:border-box;">${value || ''}</textarea>
  </label>`;
}

function sectionHead(label) {
  return `<h4 style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#505060;margin:4px 0 0;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.07);">${label}</h4>`;
}

function infoRow(label, value) {
  if (!value) return '';
  return `<div style="display:flex;flex-direction:column;gap:2px;">
    <span style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#505060;">${label}</span>
    <span style="font-size:14px;color:#f0f0f5;">${value}</span>
  </div>`;
}

function linkRow(label, url) {
  if (!url) return '';
  return `<div style="display:flex;flex-direction:column;gap:2px;">
    <span style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#505060;">${label}</span>
    <a href="${url}" target="_blank" rel="noopener"
      style="font-size:13px;color:#0A84FF;word-break:break-all;text-decoration:none;">
      ${url.length > 55 ? url.slice(0,55)+'…' : url}
    </a>
  </div>`;
}

/* -------------------------------------------------- */
/* MODAL                                              */
/* -------------------------------------------------- */

function openDetailModal(id, d, onSave) {
  document.getElementById('order-detail-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'order-detail-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:2000;
    display:flex;align-items:center;justify-content:center;padding:20px;
    background:rgba(0,0,0,0.82);backdrop-filter:blur(36px);
    opacity:0;transition:opacity .28s ease;
  `;

  overlay.innerHTML = `
    <div style="
      width:min(900px,96vw);max-height:90vh;overflow-y:auto;
      background:rgba(8,9,18,0.98);border:1px solid rgba(255,255,255,0.12);
      border-radius:24px;padding:32px;position:relative;
      box-shadow:0 24px 64px rgba(0,0,0,0.8),0 0 40px rgba(10,132,255,0.08);
      transform:scale(0.95);transition:transform .28s cubic-bezier(0.25,1,0.5,1);
    " id="order-detail-inner">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:28px;">
        <div>
          <h3 style="font-size:20px;font-weight:700;margin:0 0 8px;">${d.orderID || id}</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            ${badge(d.status || 'Pending')}
            ${badge(d.paymentStatus || 'Awaiting Deposit')}
          </div>
        </div>
        <button id="modal-close-btn" style="
          background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);
          color:#fff;width:34px;height:34px;border-radius:50%;
          font-size:18px;cursor:pointer;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          transition:background .18s,transform .18s;">✕</button>
      </div>

      <!-- Two-column body -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

        <!-- LEFT: read-only info + editable client/project fields -->
        <div style="display:flex;flex-direction:column;gap:14px;">

          ${sectionHead('Client Info — Editable')}
          ${editInput('edit-clientName',    'Client Name',    d.clientName || '',    'text', d.clientName)}
          ${editInput('edit-contactType',   'Contact Via',    d.contactType || '',   'text', d.contactType)}
          ${editInput('edit-contactValue',  'Contact Handle', d.contactValue || '',  'text', d.contactValue)}

          ${sectionHead('Project — Editable')}
          ${editInput('edit-projectType',       'Project Type',       d.projectType || '',       'text', d.projectType)}
          ${editInput('edit-deliverableFormat', 'Deliverable Format', d.deliverableFormat || '', 'text', d.deliverableFormat)}

          ${sectionHead('Links (read-only)')}
          ${linkRow('Footage',    d.footageLink)}
          ${linkRow('Music',      d.musicLink)}
          ${linkRow('Assets',     d.assetsLink)}
          ${linkRow('References', d.referenceLinks)}

          ${d.specialInstructions ? `
            ${sectionHead('Special Instructions')}
            <p style="font-size:14px;color:#88889a;white-space:pre-wrap;margin:0;">${d.specialInstructions}</p>
          ` : ''}

          ${sectionHead('Timestamps')}
          ${infoRow('Created',      formatDate(d.createdAt))}
          ${infoRow('Last Updated', formatDate(d.lastUpdate))}
        </div>

        <!-- RIGHT: status / admin fields -->
        <div style="display:flex;flex-direction:column;gap:14px;">

          ${sectionHead('Status & Payment')}
          ${editSelect('edit-status',  'Status',  ['Pending','In Progress','Review','Completed','Cancelled'], d.status || 'Pending')}
          ${editSelect('edit-payment', 'Payment', ['Awaiting Deposit','Deposit Received','Advance Paid','Paid','Refunded'], d.paymentStatus || 'Awaiting Deposit')}

          ${sectionHead('Assignment & Scheduling')}
          ${editInput('edit-assigned', 'Assigned Editor', 'Editor name or UID', 'text', d.assignedEditor)}
          ${editInput('edit-deadline', 'Deadline', '', 'date', d.deadline)}
          ${editInput('edit-price',    'Price ($)', 'e.g. 150', 'number', d.price)}

          ${sectionHead('Admin Notes')}
          ${editTextarea('edit-notes', 'Internal Notes', 'Only visible to admins…', d.adminNotes)}

          <div id="edit-feedback" style="font-size:13px;min-height:18px;"></div>

          <button id="modal-save-btn" style="
            background:#fff;color:#000;border:none;border-radius:999px;
            padding:12px 24px;font-weight:700;font-size:15px;cursor:pointer;
            transition:transform .18s,box-shadow .18s;">Save All Changes</button>

          <button id="modal-delete-btn" style="
            background:rgba(255,69,58,0.10);color:#FF453A;
            border:1px solid rgba(255,69,58,0.25);border-radius:999px;
            padding:12px 24px;font-weight:700;font-size:15px;cursor:pointer;
            transition:background .18s;margin-top:4px;">Delete Order</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    document.getElementById('order-detail-inner').style.transform = 'scale(1)';
  });

  function closeModal() {
    overlay.style.opacity = '0';
    document.getElementById('order-detail-inner').style.transform = 'scale(0.95)';
    setTimeout(() => overlay.remove(), 300);
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  const onKeyDown = e => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKeyDown); }
  };
  document.addEventListener('keydown', onKeyDown);

  // Hover effects
  const saveBtn   = document.getElementById('modal-save-btn');
  const deleteBtn = document.getElementById('modal-delete-btn');
  const closeBtn  = document.getElementById('modal-close-btn');

  saveBtn.onmouseenter   = () => { saveBtn.style.transform   = 'scale(1.03)'; saveBtn.style.boxShadow   = '0 8px 24px rgba(255,255,255,0.2)'; };
  saveBtn.onmouseleave   = () => { saveBtn.style.transform   = ''; saveBtn.style.boxShadow = ''; };
  deleteBtn.onmouseenter = () => { deleteBtn.style.background = '#FF453A'; deleteBtn.style.color = '#fff'; };
  deleteBtn.onmouseleave = () => { deleteBtn.style.background = 'rgba(255,69,58,0.10)'; deleteBtn.style.color = '#FF453A'; };
  closeBtn.onmouseenter  = () => { closeBtn.style.background  = '#FF453A'; closeBtn.style.transform = 'rotate(90deg)'; };
  closeBtn.onmouseleave  = () => { closeBtn.style.background  = 'rgba(255,255,255,0.07)'; closeBtn.style.transform = ''; };

  // Save — all fields
  saveBtn.addEventListener('click', async () => {
    const fb = document.getElementById('edit-feedback');
    saveBtn.textContent = 'Saving…';
    saveBtn.disabled    = true;

    try {
      const updates = {
        // Client info
        clientName:          document.getElementById('edit-clientName').value.trim()    || null,
        contactType:         document.getElementById('edit-contactType').value.trim()   || null,
        contactValue:        document.getElementById('edit-contactValue').value.trim()  || null,
        // Project
        projectType:         document.getElementById('edit-projectType').value.trim()       || null,
        deliverableFormat:   document.getElementById('edit-deliverableFormat').value.trim() || null,
        // Status
        status:              document.getElementById('edit-status').value,
        paymentStatus:       document.getElementById('edit-payment').value,
        // Admin
        assignedEditor:      document.getElementById('edit-assigned').value.trim() || null,
        deadline:            document.getElementById('edit-deadline').value         || null,
        adminNotes:          document.getElementById('edit-notes').value.trim()    || null,
        lastUpdate:          new Date().toISOString(),
      };

      const priceVal = document.getElementById('edit-price').value;
      if (priceVal) updates.price = Number(priceVal);

      await updateDoc(doc(db, 'orders', id), updates);
      fb.style.color  = '#30D158';
      fb.textContent  = '✓ Saved';
      toast(`Order ${d.orderID || id} updated`, 'success');
      onSave && onSave();
      setTimeout(closeModal, 700);

    } catch (err) {
      fb.style.color = '#FF453A';
      fb.textContent = '✕ Failed — check console';
      toast('Save failed', 'error');
      console.error(err);
    } finally {
      saveBtn.textContent = 'Save All Changes';
      saveBtn.disabled    = false;
    }
  });

  // Delete
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Permanently delete order ${d.orderID || id}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'orders', id));
      toast(`Order ${d.orderID || id} deleted`, 'info');
      closeModal();
    } catch (err) {
      toast('Delete failed', 'error');
      console.error(err);
    }
  });
}

/* -------------------------------------------------- */
/* STATS BAR                                          */
/* -------------------------------------------------- */

function updateStats(orders) {
  const total       = orders.length;
  const pending     = orders.filter(o => o.status === 'Pending').length;
  const inprogress  = orders.filter(o => o.status === 'In Progress').length;
  const review      = orders.filter(o => o.status === 'Review').length;
  const completed   = orders.filter(o => o.status === 'Completed').length;
  const revenue     = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  const paidRevenue = orders
    .filter(o => o.paymentStatus === 'Paid')
    .reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total',       total);
  set('stat-pending',     pending);
  set('stat-inprogress',  inprogress);
  set('stat-review',      review);
  set('stat-completed',   completed);
  set('stat-revenue',     revenue > 0 ? `$${revenue.toLocaleString()}` : '—');
  set('stat-revenue-sub', paidRevenue > 0 ? `$${paidRevenue.toLocaleString()} collected` : '');

  const refreshEl = document.getElementById('last-refresh');
  if (refreshEl) refreshEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

/* -------------------------------------------------- */
/* MAIN EXPORT                                        */
/* -------------------------------------------------- */

export function initAdminOrders() {
  const list = document.getElementById('orders-list');
  if (!list) return console.warn('orders-list container not found');

  const statusFilterEl  = document.getElementById('orders-filter-status');
  const paymentFilterEl = document.getElementById('orders-filter-payment');
  const searchEl        = document.getElementById('orders-search');
  const countEl         = document.getElementById('orders-count');
  const sortBtn         = document.getElementById('orders-sort');
  const bulkBar         = document.getElementById('bulk-bar');
  const bulkCount       = document.getElementById('bulk-count');
  const bulkStatus      = document.getElementById('bulk-status');
  const bulkPayment     = document.getElementById('bulk-payment');
  const bulkApply       = document.getElementById('bulk-apply');
  const bulkClear       = document.getElementById('bulk-clear');

  let ordersCache = [];
  let sortDir     = 'desc';
  let selectedIds = new Set();

  /* ── render ── */
  function renderOrders() {
    const statusFilter  = statusFilterEl?.value  || '';
    const paymentFilter = paymentFilterEl?.value || '';
    const searchTerm    = (searchEl?.value || '').trim().toLowerCase();

    list.innerHTML = '';

    let filtered = ordersCache.filter(({ id, data: d }) => {
      if (statusFilter  && (d.status        || '').toLowerCase() !== statusFilter.toLowerCase())  return false;
      if (paymentFilter && (d.paymentStatus || '').toLowerCase() !== paymentFilter.toLowerCase()) return false;
      if (searchTerm) {
        const hay = [d.orderID, d.clientName, d.contactValue, d.projectType, id].join(' ').toLowerCase();
        return hay.includes(searchTerm);
      }
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      const ta = a.data.createdAt?.toMillis?.() || 0;
      const tb = b.data.createdAt?.toMillis?.() || 0;
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });

    if (countEl) countEl.textContent = `${filtered.length} order${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
      list.innerHTML = '<p style="color:#505060;padding:16px 0;font-family:monospace;">No orders found.</p>';
      return;
    }

    filtered.forEach(({ id, data: d }) => {
      const card = document.createElement('div');
      card.className = 'order-card card';
      card.style.cssText = 'cursor:pointer;transition:transform .25s,box-shadow .25s;';

      const isSelected  = selectedIds.has(id);
      const contactLine = d.contactType && d.contactValue
        ? `<span style="color:#0A84FF;font-size:13px;">📨 ${d.contactType}: ${d.contactValue}</span>`
        : '';

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:start;gap:10px;flex:1;min-width:0;">
            <input type="checkbox" class="order-select-check" data-id="${id}"
              style="margin-top:4px;width:16px;height:16px;cursor:pointer;accent-color:#0A84FF;flex-shrink:0;"
              ${isSelected ? 'checked' : ''}>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                <h4 style="margin:0;font-size:16px;font-weight:700;">${d.orderID || id}</h4>
                <button class="copy-id-btn" title="Copy Order ID" style="
                  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);
                  color:#88889a;padding:2px 10px;border-radius:999px;font-size:11px;
                  cursor:pointer;font-family:monospace;">copy</button>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
                ${badge(d.status || 'Pending')}
                ${badge(d.paymentStatus || 'Awaiting Deposit')}
              </div>
              <p style="margin:0 0 3px;font-size:14px;">
                <strong>${d.clientName || '—'}</strong>
                <span style="color:#88889a;"> • ${d.projectType || '—'} • ${d.deliverableFormat || '—'}</span>
              </p>
              ${contactLine ? `<p style="margin:4px 0 0;">${contactLine}</p>` : ''}
              <p style="color:#88889a;font-size:13px;margin:4px 0 0;">
                ${d.assignedEditor ? `🎬 ${d.assignedEditor}  ` : ''}
                ${d.price          ? `💰 $${d.price}` : ''}
                ${d.deadline       ? `  📅 ${d.deadline}` : ''}
              </p>
              <p style="color:#505060;font-size:12px;margin:6px 0 0;font-family:monospace;">
                Created: ${formatDate(d.createdAt)}
                ${d.lastUpdate ? `  ·  Updated: ${formatDate(d.lastUpdate)}` : ''}
              </p>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;flex-shrink:0;">
            <button class="quick-edit-btn" style="
              background:#fff;color:#000;border:none;border-radius:999px;
              padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer;
              transition:transform .15s,box-shadow .15s;white-space:nowrap;">Manage →</button>
            <button class="quick-delete-btn" style="
              background:rgba(255,69,58,0.08);color:#FF453A;
              border:1px solid rgba(255,69,58,0.20);border-radius:999px;
              padding:6px 16px;font-size:13px;font-weight:600;cursor:pointer;
              transition:background .15s;white-space:nowrap;">Delete</button>
          </div>
        </div>
      `;

      // Checkbox
      const checkbox = card.querySelector('.order-select-check');
      checkbox.addEventListener('change', e => {
        e.stopPropagation();
        if (e.target.checked) selectedIds.add(id);
        else                  selectedIds.delete(id);
        updateBulkBar();
      });

      // Open modal
      card.addEventListener('click', e => {
        if (e.target.closest('button') || e.target.type === 'checkbox') return;
        openDetailModal(id, d, renderOrders);
      });

      card.querySelector('.quick-edit-btn').addEventListener('click', e => {
        e.stopPropagation();
        openDetailModal(id, d, renderOrders);
      });

      const deleteBtn = card.querySelector('.quick-delete-btn');
      deleteBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Delete order ${d.orderID || id}?`)) return;
        try {
          await deleteDoc(doc(db, 'orders', id));
          selectedIds.delete(id);
          updateBulkBar();
          toast(`Order ${d.orderID || id} deleted`, 'info');
        } catch (err) { toast('Delete failed', 'error'); console.error(err); }
      });

      const copyBtn = card.querySelector('.copy-id-btn');
      copyBtn.addEventListener('click', e => {
        e.stopPropagation();
        copyToClipboard(d.orderID || id);
        copyBtn.textContent = 'copied!';
        copyBtn.style.color = '#30D158';
        setTimeout(() => { copyBtn.textContent = 'copy'; copyBtn.style.color = ''; }, 1500);
      });

      // Hover
      card.onmouseenter = () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 12px 32px rgba(0,0,0,0.5)'; };
      card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = ''; };

      const manageBtn = card.querySelector('.quick-edit-btn');
      manageBtn.onmouseenter = () => { manageBtn.style.transform = 'scale(1.04)'; manageBtn.style.boxShadow = '0 6px 18px rgba(255,255,255,0.2)'; };
      manageBtn.onmouseleave = () => { manageBtn.style.transform = ''; manageBtn.style.boxShadow = ''; };
      deleteBtn.onmouseenter = () => { deleteBtn.style.background = '#FF453A'; deleteBtn.style.color = '#fff'; };
      deleteBtn.onmouseleave = () => { deleteBtn.style.background = 'rgba(255,69,58,0.08)'; deleteBtn.style.color = '#FF453A'; };

      list.appendChild(card);
    });
  }

  /* ── bulk bar ── */
  function updateBulkBar() {
    if (!bulkBar) return;
    const n = selectedIds.size;
    if (n > 0) {
      bulkBar.classList.add('visible');
      if (bulkCount) bulkCount.textContent = `${n} selected`;
    } else {
      bulkBar.classList.remove('visible');
    }
  }

  bulkApply?.addEventListener('click', async () => {
    const newStatus  = bulkStatus?.value  || '';
    const newPayment = bulkPayment?.value || '';
    if (!newStatus && !newPayment) { toast('Choose a status or payment to apply', 'error'); return; }
    if (!selectedIds.size)         { toast('No orders selected', 'error'); return; }

    bulkApply.disabled    = true;
    bulkApply.textContent = 'Applying…';
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const updates = { lastUpdate: new Date().toISOString() };
        if (newStatus)  updates.status        = newStatus;
        if (newPayment) updates.paymentStatus = newPayment;
        batch.update(doc(db, 'orders', id), updates);
      });
      await batch.commit();
      toast(`Updated ${selectedIds.size} order${selectedIds.size !== 1 ? 's' : ''}`, 'success');
      selectedIds.clear();
      if (bulkStatus)  bulkStatus.value  = '';
      if (bulkPayment) bulkPayment.value = '';
      updateBulkBar();
    } catch (err) {
      toast('Bulk update failed', 'error');
      console.error(err);
    } finally {
      bulkApply.disabled    = false;
      bulkApply.textContent = 'Apply';
    }
  });

  bulkClear?.addEventListener('click', () => {
    selectedIds.clear();
    updateBulkBar();
    renderOrders();
  });

  /* ── sort ── */
  sortBtn?.addEventListener('click', () => {
    sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    if (sortBtn) sortBtn.textContent = sortDir === 'desc' ? '↓ Newest' : '↑ Oldest';
    renderOrders();
  });

  /* ── filters ── */
  function debounce(fn, t = 250) {
    let timer;
    return (...a) => { clearTimeout(timer); timer = setTimeout(() => fn(...a), t); };
  }
  statusFilterEl?.addEventListener('change', renderOrders);
  paymentFilterEl?.addEventListener('change', renderOrders);
  searchEl?.addEventListener('input', debounce(renderOrders, 200));

  /* ── keyboard ── */
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== searchEl && !document.getElementById('order-detail-modal')) {
      e.preventDefault(); searchEl?.focus();
    }
    if (e.key === 'e' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      exportCSV();
    }
  });

  /* ── real-time listener ── */
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snapshot => {
    ordersCache = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
    updateStats(ordersCache.map(o => o.data));
    renderOrders();
  }, err => console.error('Orders listener error', err));

  /* ── CSV export ── */
  function exportCSV() {
    if (!ordersCache.length) { toast('No orders to export', 'error'); return; }
    const rows = ordersCache.map(({ id, data: d }) => ({
      orderID:             d.orderID || id,
      clientName:          d.clientName || '',
      contactType:         d.contactType || '',
      contactValue:        d.contactValue || '',
      projectType:         d.projectType || '',
      deliverableFormat:   d.deliverableFormat || '',
      footageLink:         d.footageLink || '',
      musicLink:           d.musicLink || '',
      assetsLink:          d.assetsLink || '',
      referenceLinks:      d.referenceLinks || '',
      specialInstructions: d.specialInstructions || '',
      deadline:            d.deadline || '',
      price:               d.price || '',
      status:              d.status || '',
      paymentStatus:       d.paymentStatus || '',
      assignedEditor:      d.assignedEditor || '',
      adminNotes:          d.adminNotes || '',
      lastUpdate:          d.lastUpdate || '',
      createdAt:           d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : (d.createdAt || ''),
    }));
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
    ].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `cosmic_orders_${new Date().toISOString().slice(0,10)}.csv`,
    });
    document.body.appendChild(a); a.click(); a.remove();
    toast('CSV exported', 'success');
  }

  document.getElementById('orders-export')?.addEventListener('click', exportCSV);
}