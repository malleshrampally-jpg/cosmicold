// Simple skeel click and subtle ripple utilities
function attachSkeel() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-skeel]');
    if (!el) return;

    el.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(0.97)' },
      { transform: 'scale(1)' }
    ], {
      duration: 240,
      easing: 'cubic-bezier(.2,.8,.2,1)'
    });
  }, { passive: true });
}

function addRipple(el, x, y) {
  const r = document.createElement('span');
  r.className = 'cosmic-ripple';
  r.style.left = x + 'px';
  r.style.top = y + 'px';
  el.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

export { attachSkeel, addRipple };
