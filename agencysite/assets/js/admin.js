// ============================================================
// admin.js — Toast utility + keyboard shortcuts + logout
// Does NOT do auth guard so it doesn't block page render
// ============================================================
  import '../assets/js/admin/admin.js';
  import '../assets/js/admin/orders.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// ── Toast ────────────────────────────────────────────────────
window.showToast = function(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration);
};

// ── Logout ───────────────────────────────────────────────────
const auth = getAuth();
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '/admin/login.html';
});

// ── Keyboard shortcuts ───────────────────────────────────────
document.addEventListener('keydown', e => {
  const active = document.activeElement;
  const typing = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT';
  if (e.key === 'Escape') {
    document.getElementById('order-modal')?.classList.remove('open');
    document.getElementById('confirm-dialog')?.classList.remove('open');
  }
  if (e.key === '/' && !typing) {
    e.preventDefault();
    document.getElementById('orders-search')?.focus();
  }
  if ((e.key === 'e' || e.key === 'E') && !typing) {
    document.getElementById('orders-export')?.click();
  }
});