// Minimal modal system used by order/contact flows
const MODAL_ID = 'cosmic-modal-overlay';

function buildModal() {
  if (document.getElementById(MODAL_ID)) return;
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.className = 'cosmic-modal-overlay';
  overlay.innerHTML = `
    <div class="cosmic-modal">
      <button class="cosmic-modal-close" aria-label="Close">✕</button>
      <div class="cosmic-modal-body" role="dialog" aria-modal="true"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  overlay.querySelector('.cosmic-modal-close').addEventListener('click', closeModal);
}

function openModal(html) {
  buildModal();
  const overlay = document.getElementById(MODAL_ID);
  overlay.querySelector('.cosmic-modal-body').innerHTML = html;
  overlay.classList.add('open');
  document.documentElement.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;
  overlay.classList.remove('open');
  document.documentElement.style.overflow = '';
}

export { openModal, closeModal };
