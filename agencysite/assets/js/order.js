// ============================================================
// orders.js — Full admin control over every order field
// ============================================================
import { db } from '/assets/js/firebase.js';
import {
  collection, query, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp, writeBatch, getDocs
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// ── State ────────────────────────────────────────────────────
let allOrders      = [];
let filteredOrders = [];
let sortAsc        = false;
let selectedIds    = new Set();

// ── DOM ──────────────────────────────────────────────────────
const listEl        = document.getElementById('orders-list');
const countPill     = document.getElementById('orders-count');
const searchEl      = document.getElementById('orders-search');
const filterStatus  = document.getElementById('orders-filter-status');
const filterPay     = document.getElementById('orders-filter-payment');
const sortBtn       = document.getElementById('orders-sort');
const exportBtn     = document.getElementById('orders-export');
const refreshBtn    = document.getElementById('refresh-btn');
const lastRefresh   = document.getElementById('last-refresh');
const bulkBar       = document.getElementById('bulk-bar');
const bulkCount     = document.getElementById('bulk-count');
const bulkStatus    = document.getElementById('bulk-status');
const bulkPay       = document.getElementById('bulk-payment');
const bulkApply     = document.getElementById('bulk-apply');
const bulkClear     = document.getElementById('bulk-clear');
const statTotal     = document.getElementById('stat-total');
const statPending   = document.getElementById('stat-pending');
const statInProg    = document.getElementById('stat-inprogress');
const statReview    = document.getElementById('stat-review');
const statCompleted = document.getElementById('stat-completed');
const statRevenue   = document.getElementById('stat-revenue');
const statRevSub    = document.getElementById('stat-revenue-sub');
const modal         = document.getElementById('order-modal');
const modalClose    = document.getElementById('modal-close-btn');
const confirmDlg    = document.getElementById('confirm-dialog');
const confirmMsg    = document.getElementById('confirm-msg');
const confirmYes    = document.getElementById('confirm-yes');
const confirmNo     = document.getElementById('confirm-no');

const toast = (msg, type = 'info') => window.showToast?.(msg, type);

// ── XSS helper ───────────────────────────────────────────────
const e = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Timestamp normaliser ─────────────────────────────────────
function toISO(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val.toDate) return val.toDate().toISOString();
  if (val.seconds) return new Date(val.seconds * 1000).toISOString();
  return '';
}

// ── Badge helpers ────────────────────────────────────────────
function statusBadge(s = '') {
  const v = s.toLowerCase();
  if (v === 'pending')                                    return 'badge-pending';
  if (v.includes('progress'))                             return 'badge-progress';
  if (v === 'review')                                     return 'badge-review';
  if (v.includes('complet') || v.includes('delivered'))  return 'badge-complete';
  if (v.includes('cancel'))                               return 'badge-cancelled';
  return 'badge-default';
}
function payBadge(s = '') {
  const v = s.toLowerCase();
  if (v === 'paid')                                       return 'badge-paid';
  if (v.includes('advance') || v.includes('deposit'))    return 'badge-deposit';
  if (v.includes('refund'))                               return 'badge-refunded';
  return 'badge-awaiting';
}

// ── Stats ────────────────────────────────────────────────────
function updateStats() {
  if (statTotal)     statTotal.textContent     = allOrders.length;
  if (statPending)   statPending.textContent   = allOrders.filter(o => (o.status||'') === 'Pending').length;
  if (statInProg)    statInProg.textContent    = allOrders.filter(o => (o.status||'').includes('Progress')).length;
  if (statReview)    statReview.textContent    = allOrders.filter(o => (o.status||'') === 'Review').length;
  if (statCompleted) statCompleted.textContent = allOrders.filter(o => (o.status||'').includes('Complet')).length;
  const rev  = allOrders.reduce((s,o) => s + (parseFloat(o.price)       || 0), 0);
  const coll = allOrders.reduce((s,o) => s + (parseFloat(o.advancePaid) || 0), 0);
  if (statRevenue) statRevenue.textContent = '$' + rev.toLocaleString();
  if (statRevSub)  statRevSub.textContent  = '$' + coll.toLocaleString() + ' collected';
  if (lastRefresh) lastRefresh.textContent = allOrders.length
    ? 'Updated ' + new Date().toLocaleTimeString()
    : 'Connected — no orders yet';
}

// ── Filter + sort ────────────────────────────────────────────
function applyFilters() {
  const s  = (searchEl?.value || '').toLowerCase();
  const sf = filterStatus?.value || '';
  const pf = filterPay?.value    || '';

  filteredOrders = allOrders.filter(o => {
    const match = !s ||
      (o.orderID       ||'').toLowerCase().includes(s) ||
      (o.clientName    ||'').toLowerCase().includes(s) ||
      (o.email         ||'').toLowerCase().includes(s) ||
      (o.contactValue  ||'').toLowerCase().includes(s) ||
      (o.projectType   ||'').toLowerCase().includes(s) ||
      (o.serviceType   ||'').toLowerCase().includes(s);
    return match
      && (!sf || (o.status        ||'') === sf)
      && (!pf || (o.paymentStatus ||'') === pf);
  });

  filteredOrders.sort((a, b) => {
    const da = a._sortKey || '', db_ = b._sortKey || '';
    return sortAsc ? da.localeCompare(db_) : db_.localeCompare(da);
  });

  renderList();
  updateStats();
  if (countPill) countPill.textContent = filteredOrders.length + ' order' + (filteredOrders.length !== 1 ? 's' : '');
}

// ── Render list ───────────────────────────────────────────────
function renderList() {
  if (!filteredOrders.length) {
    listEl.innerHTML = `<div class="orders-empty"><div class="emoji">🔍</div>No orders found.</div>`;
    return;
  }

  listEl.innerHTML = filteredOrders.map(o => `
    <div class="order-card ${selectedIds.has(o.id) ? 'selected' : ''}" data-id="${o.id}">
      <input type="checkbox" class="order-select-check" data-id="${o.id}"
        ${selectedIds.has(o.id) ? 'checked' : ''} onclick="event.stopPropagation()">
      <div class="order-card-info">
        <div class="order-id">${e(o.orderID || o.id)}</div>
        <div class="order-name">${e(o.clientName || '—')}</div>
        <div class="order-meta">
          ${e(o.email || o.contactValue || '')}
          ${o.deadline ? ' · Due: ' + e(o.deadline) : ''}
          ${o._sortKey ? ' · ' + new Date(o._sortKey).toLocaleDateString() : ''}
        </div>
      </div>
      <div class="order-badges">
        <span class="badge ${statusBadge(o.status)}">${e(o.status || 'Pending')}</span>
        <span class="badge ${payBadge(o.paymentStatus)}">${e(o.paymentStatus || '—')}</span>
        ${o.remainingAmount > 0 && o.paymentStatus !== 'Paid'
          ? `<span class="badge badge-awaiting">$${o.remainingAmount} due</span>` : ''}
      </div>
      <div class="order-card-actions">
        <button class="card-edit-btn" data-id="${o.id}" onclick="event.stopPropagation()">Edit</button>
      </div>
    </div>`).join('');

  listEl.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', ev => {
      if (ev.target.closest('.order-select-check,.card-edit-btn')) return;
      openModal(card.dataset.id);
    });
  });
  listEl.querySelectorAll('.card-edit-btn').forEach(btn =>
    btn.addEventListener('click', () => openModal(btn.dataset.id)));
  listEl.querySelectorAll('.order-select-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedIds.add(cb.dataset.id);
      else            selectedIds.delete(cb.dataset.id);
      updateBulkBar();
      cb.closest('.order-card').classList.toggle('selected', cb.checked);
    });
  });
}

// ── Bulk ─────────────────────────────────────────────────────
function updateBulkBar() {
  bulkBar?.classList.toggle('visible', selectedIds.size > 0);
  if (bulkCount) bulkCount.textContent = selectedIds.size + ' selected';
}
bulkClear?.addEventListener('click', () => { selectedIds.clear(); updateBulkBar(); renderList(); });
bulkApply?.addEventListener('click', async () => {
  const ns = bulkStatus?.value, np = bulkPay?.value;
  if (!ns && !np) { toast('Choose a value to apply', 'error'); return; }
  const batch = writeBatch(db);
  selectedIds.forEach(id => {
    const u = { updatedAt: serverTimestamp() };
    if (ns) u.status        = ns;
    if (np) u.paymentStatus = np;
    batch.update(doc(db, 'orders', id), u);
  });
  try {
    await batch.commit();
    toast(`Updated ${selectedIds.size} orders`, 'success');
    selectedIds.clear(); if(bulkStatus)bulkStatus.value=''; if(bulkPay)bulkPay.value='';
    updateBulkBar();
  } catch(err) { toast('Bulk update failed: ' + err.message, 'error'); }
});

// ── Export CSV ───────────────────────────────────────────────
exportBtn?.addEventListener('click', () => {
  const cols = ['orderID','clientName','email','contactType','contactValue',
    'projectType','serviceType','status','paymentStatus','price','advancePaid',
    'remainingAmount','deadline','assignedEditor','deliverableFormat',
    'footageLink','assetsLink','musicLink','referenceLinks',
    'specialInstructions','paypalTransactionID','balanceTransactionID',
    'submittedAt','agreementAccepted'];
  const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const rows = [cols.join(','), ...filteredOrders.map(o => cols.map(c=>esc(o[c])).join(','))];
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})),
    download: `orders-${Date.now()}.csv`
  });
  a.click(); toast('CSV exported', 'success');
});

sortBtn?.addEventListener('click', () => {
  sortAsc = !sortAsc;
  if (sortBtn) sortBtn.textContent = sortAsc ? '↑ Oldest' : '↓ Newest';
  applyFilters();
});
searchEl?.addEventListener('input', applyFilters);
filterStatus?.addEventListener('change', applyFilters);
filterPay?.addEventListener('change', applyFilters);
refreshBtn?.addEventListener('click', applyFilters);
modalClose?.addEventListener('click', () => modal?.classList.remove('open'));
confirmNo?.addEventListener('click',  () => confirmDlg?.classList.remove('open'));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FULL EDIT MODAL — every field editable
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STEPS = [
  'Order Submitted','Project Reviewed','Payment Received',
  'Editing Started','Draft Delivered','Revisions Requested','Final Delivery',
];

function field(label, inputHTML, note = '') {
  return `
    <div class="modal-field">
      <label>${label}${note ? `<span class="field-note">${note}</span>` : ''}</label>
      ${inputHTML}
    </div>`;
}

function roField(label, value, note = '') {
  const display = value
    ? (value.startsWith?.('http') ? `<a href="${e(value)}" target="_blank" rel="noopener">${e(value)}</a>` : e(value))
    : `<span class="empty-val">—</span>`;
  return `
    <div class="modal-field">
      <label>${label}${note ? `<span class="field-note">${note}</span>` : ''}</label>
      <div class="read-val">${display}</div>
    </div>`;
}

function sel(id, options, current) {
  return `<select id="${id}">${options.map(v =>
    `<option${v===current?' selected':''}>${e(v)}</option>`).join('')}</select>`;
}

function inp(id, value, type='text', placeholder='') {
  return `<input id="${id}" type="${type}" value="${e(value??'')}" placeholder="${e(placeholder)}">`;
}

function txta(id, value, rows=3, placeholder='') {
  return `<textarea id="${id}" rows="${rows}" placeholder="${e(placeholder)}">${e(value??'')}</textarea>`;
}

function openModal(docId) {
  const o = allOrders.find(x => x.id === docId);
  if (!o) return;

  const step = o.currentStep || 1;

  const servicesList = o.services?.length
    ? o.services.map(s =>
        `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--border);font-size:12px;">
          <span>${e(s.name)} × ${s.quantity||1}</span>
          <span style="font-family:var(--font-mono);">$${(s.priceRaw||0)*(s.quantity||1)}</span>
        </div>`).join('')
    : `<div style="font-size:12px;color:var(--text-2);">${e(o.serviceType||o.projectType||'—')}</div>`;

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">${e(o.clientName||'Order')}</div>
    <div class="modal-subtitle">${e(o.orderID||docId)} &nbsp;·&nbsp; ${o._sortKey ? new Date(o._sortKey).toLocaleString() : '—'}</div>

    <div class="modal-tabs">
      <button class="modal-tab active" data-tab="status">📋 Status</button>
      <button class="modal-tab" data-tab="client">👤 Client</button>
      <button class="modal-tab" data-tab="project">🎬 Project</button>
      <button class="modal-tab" data-tab="links">🔗 Links</button>
      <button class="modal-tab" data-tab="payment">💳 Payment</button>
      <button class="modal-tab" data-tab="admin">⚙️ Admin</button>
    </div>

    <!-- ── STATUS ── -->
    <div class="tab-panel active" id="tab-status">
      <div class="field-group">
        <div class="field-group-title">Order Status</div>
        <div class="fields-grid">
          ${field('Order Status', sel('f-status',
            ['Pending','In Progress','Review','Completed','Cancelled'], o.status||'Pending'))}
          ${field('Payment Status', sel('f-paymentStatus',
            ['Awaiting Deposit','Deposit Received','Advance Paid','Paid','Refunded'], o.paymentStatus||'Awaiting Deposit'))}
        </div>
      </div>

      <div class="field-group">
        <div class="field-group-title">Workflow Step — click to set</div>
        <div class="step-selector">
          ${STEPS.map((label,i) => `
            <button class="step-btn${i+1===step?' active':''}" data-step="${i+1}" title="${label}">
              <span class="step-num">${i+1}</span>
              <span>${label.split(' ')[0]}</span>
            </button>`).join('')}
        </div>
        <input type="hidden" id="f-currentStep" value="${step}">
        <div id="step-label" style="margin-top:8px;font-size:12px;color:var(--blue);font-family:var(--font-mono);">
          Step ${step}: ${STEPS[step-1]}
        </div>
      </div>

      <div class="field-group">
        <div class="field-group-title">Assigned Editor</div>
        <div class="fields-grid single">
          ${field('Editor Name / Handle', inp('f-assignedEditor', o.assignedEditor, 'text', 'e.g. @editor_handle'))}
        </div>
      </div>

      <div class="field-group">
        <div class="field-group-title">Update Message <span class="field-note">shown to client on track page</span></div>
        <div class="fields-grid single">
          ${field('', txta('f-lastUpdate', o.lastUpdate, 3, 'e.g. Your draft is ready, please review…'))}
        </div>
      </div>
    </div>

    <!-- ── CLIENT ── -->
    <div class="tab-panel" id="tab-client">
      <div class="field-group">
        <div class="field-group-title">Client Identity</div>
        <div class="fields-grid">
          ${field('Full Name',  inp('f-clientName',  o.clientName,  'text',  'Client full name'))}
          ${field('Email',      inp('f-email',       o.email,       'email', 'client@email.com'))}
        </div>
      </div>
      <div class="field-group">
        <div class="field-group-title">Contact</div>
        <div class="fields-grid">
          ${field('Contact Type', sel('f-contactType',
            ['','Discord','Email','WhatsApp'], o.contactType||''))}
          ${field('Contact Value', inp('f-contactValue', o.contactValue, 'text', 'Handle / number / address'))}
        </div>
      </div>
    </div>

    <!-- ── PROJECT ── -->
    <div class="tab-panel" id="tab-project">
      <div class="field-group">
        <div class="field-group-title">Services Ordered</div>
        ${servicesList}
      </div>
      <div class="field-group">
        <div class="field-group-title">Project Details</div>
        <div class="fields-grid">
          ${field('Project Type', sel('f-projectType',
            ['YouTube','Reel','Ad','Documentary','Custom Project','Short Form',
             'Retention','Advertisement','Multiple Services'],
            o.projectType||o.serviceType||''))}
          ${field('Deadline', inp('f-deadline', o.deadline, 'date'))}
          ${field('Deliverable Format', sel('f-deliverableFormat',
            ['','1080p','4K','Reel Ratio','Custom'], o.deliverableFormat||''))}
        </div>
      </div>
      <div class="field-group">
        <div class="field-group-title">Special Instructions</div>
        <div class="fields-grid single">
          ${field('', txta('f-specialInstructions', o.specialInstructions, 4, 'Client instructions…'))}
        </div>
      </div>
    </div>

    <!-- ── LINKS ── -->
    <div class="tab-panel" id="tab-links">
      <div class="field-group">
        <div class="field-group-title">Asset Links — editable</div>
        <div class="fields-grid single">
          ${field('Footage Link',    inp('f-footageLink',    o.footageLink,    'url', 'https://'))}
          ${field('Assets Link',     inp('f-assetsLink',     o.assetsLink,     'url', 'https://'))}
          ${field('Music Link',      inp('f-musicLink',      o.musicLink,      'url', 'https://'))}
          ${field('Reference Links', inp('f-referenceLinks', o.referenceLinks, 'url', 'https://'))}
        </div>
      </div>
    </div>

    <!-- ── PAYMENT ── -->
    <div class="tab-panel" id="tab-payment">
      <div class="field-group">
        <div class="field-group-title">Amounts — fully editable</div>
        <div class="fields-grid">
          ${field('Total Price ($)',      inp('f-price',           o.price||0,           'number'))}
          ${field('Advance Paid ($)',     inp('f-advancePaid',     o.advancePaid||0,     'number'))}
          ${field('Remaining Amount ($)', inp('f-remainingAmount', o.remainingAmount||0, 'number'))}
        </div>
      </div>
      <div class="field-group">
        <div class="field-group-title">PayPal Transaction IDs — editable</div>
        <div class="fields-grid single">
          ${field('Advance Transaction ID',  inp('f-paypalTransactionID',  o.paypalTransactionID,  'text', 'PayPal TXN ID'))}
          ${field('Balance Transaction ID',  inp('f-balanceTransactionID', o.balanceTransactionID, 'text', 'PayPal TXN ID'))}
        </div>
      </div>
    </div>

    <!-- ── ADMIN ── -->
    <div class="tab-panel" id="tab-admin">
      <div class="field-group">
        <div class="field-group-title">Internal Notes <span class="field-note">never shown to client</span></div>
        <div class="fields-grid single">
          ${field('', txta('f-adminNotes', o.adminNotes, 5, 'Internal notes about this order…'))}
        </div>
      </div>
      <div class="field-group">
        <div class="field-group-title">Read-only Metadata</div>
        <div class="fields-grid">
          ${roField('Order ID',       o.orderID||docId)}
          ${roField('Firestore Doc',  docId, 'internal ID')}
          ${roField('Submitted At',   o._sortKey ? new Date(o._sortKey).toLocaleString() : '—')}
          ${roField('Terms Agreed',   o.agreementAccepted ? '✅ Yes' : '—')}
          ${roField('Agreement Time', o.agreementTimestamp || '—')}
          ${roField('Balance Paid At', o.balancePaidAt ? toISO(o.balancePaidAt) : '—')}
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-save"   id="modal-save-btn">💾 Save All Changes</button>
      <button class="modal-cancel" id="modal-cancel-btn">Cancel</button>
      <button class="modal-delete" id="modal-delete-btn">🗑 Delete Order</button>
    </div>
  `;

  modal.classList.add('open');

  // Tab switching
  const mc = document.getElementById('modal-content');
  mc.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mc.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      mc.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      mc.querySelector(`#tab-${tab.dataset.tab}`)?.classList.add('active');
    });
  });

  // Step buttons
  mc.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      mc.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('f-currentStep').value = btn.dataset.step;
      document.getElementById('step-label').textContent =
        `Step ${btn.dataset.step}: ${STEPS[btn.dataset.step-1]}`;
    });
  });

  mc.querySelector('#modal-save-btn').addEventListener('click',   () => saveOrder(docId));
  mc.querySelector('#modal-cancel-btn').addEventListener('click', () => modal.classList.remove('open'));
  mc.querySelector('#modal-delete-btn').addEventListener('click', () => {
    confirmMsg.textContent = `Delete "${o.orderID||docId}" for ${o.clientName}? This cannot be undone.`;
    confirmDlg.classList.add('open');
    confirmYes.onclick = async () => {
      try {
        await deleteDoc(doc(db, 'orders', docId));
        confirmDlg.classList.remove('open');
        modal.classList.remove('open');
        toast('Order deleted', 'success');
      } catch(err) { toast('Delete failed: ' + err.message, 'error'); }
    };
  });
}

// ── Save — writes every editable field ───────────────────────
async function saveOrder(docId) {
  const btn = document.getElementById('modal-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const g  = id => document.getElementById(id)?.value ?? '';
  const gn = id => parseFloat(document.getElementById(id)?.value) || 0;
  const step = parseInt(g('f-currentStep')) || 1;

  try {
    await updateDoc(doc(db, 'orders', docId), {
      // Status
      status:               g('f-status'),
      paymentStatus:        g('f-paymentStatus'),
      currentStep:          step,
      currentStatus:        STEPS[step-1] || '',
      assignedEditor:       g('f-assignedEditor'),
      lastUpdate:           g('f-lastUpdate'),
      // Client
      clientName:           g('f-clientName'),
      email:                g('f-email'),
      contactType:          g('f-contactType'),
      contactValue:         g('f-contactValue'),
      // Project
      projectType:          g('f-projectType'),
      serviceType:          g('f-projectType'),   // keep both in sync
      deadline:             g('f-deadline'),
      deliverableFormat:    g('f-deliverableFormat'),
      specialInstructions:  g('f-specialInstructions'),
      // Links
      footageLink:          g('f-footageLink'),
      assetsLink:           g('f-assetsLink'),
      musicLink:            g('f-musicLink'),
      referenceLinks:       g('f-referenceLinks'),
      // Payment
      price:                gn('f-price'),
      advancePaid:          gn('f-advancePaid'),
      remainingAmount:      gn('f-remainingAmount'),
      paypalTransactionID:  g('f-paypalTransactionID'),
      balanceTransactionID: g('f-balanceTransactionID'),
      // Admin
      adminNotes:           g('f-adminNotes'),
      // Meta
      updatedAt:            serverTimestamp(),
    });
    toast('Saved ✓', 'success');
    modal.classList.remove('open');
  } catch(err) {
    console.error(err);
    toast('Save failed: ' + err.message, 'error');
    btn.disabled = false; btn.textContent = '💾 Save All Changes';
  }
}

// ── Firestore listener ────────────────────────────────────────
function startListener() {
  if (lastRefresh) lastRefresh.textContent = 'Connecting…';
  console.log('[Admin] Starting Firestore listener…');

  onSnapshot(
    query(collection(db, 'orders')),
    snap => {
      console.log('[Admin] Got', snap.docs.length, 'orders');
      allOrders = snap.docs.map(d => {
        const data = d.data();
        const ts   = toISO(data.submittedAt || data.createdAt);
        return { id: d.id, ...data, _sortKey: ts };
      });
      allOrders.sort((a,b) => b._sortKey.localeCompare(a._sortKey));
      applyFilters();
    },
    err => {
      console.error('[Admin] Firestore error:', err.code, err.message);
      if (lastRefresh) lastRefresh.textContent = '⚠️ ' + err.code;
      if (listEl) listEl.innerHTML = `
        <div class="orders-empty">
          <div class="emoji">⚠️</div>
          <div style="font-weight:700;margin-bottom:6px;">Firestore error: ${err.code}</div>
          <div style="font-size:12px;color:var(--text-3);max-width:420px;line-height:1.7;">
            ${err.message}<br><br>
            Fix: Firebase Console → Firestore → Rules →<br>
            <code style="font-size:11px;">allow read, write: if request.auth != null;</code>
          </div>
        </div>`;
    }
  );
}

startListener();