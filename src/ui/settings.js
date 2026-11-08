// Gestion de la clé Finnhub (stockée uniquement dans le navigateur).
const KEY = 'aiorbit.finnhubKey';

export function getApiKey() {
  try {
    const k = localStorage.getItem(KEY);
    if (k === '__demo__') return '';
    if (k) return k;
  } catch { /* stockage indisponible */ }
  return import.meta.env.VITE_FINNHUB_KEY || '';
}

export function createSettings(dialog, input, { onChange } = {}) {
  function open() {
    input.value = getApiKey();
    dialog.showModal();
    setTimeout(() => input.focus(), 50);
  }
  dialog.addEventListener('close', () => {
    const v = dialog.returnValue;
    try {
      if (v === 'save' && input.value.trim()) {
        localStorage.setItem(KEY, input.value.trim());
        onChange?.();
      } else if (v === 'demo') {
        localStorage.setItem(KEY, '__demo__');
        onChange?.();
      }
    } catch { /* stockage indisponible */ }
  });
  return { open };
}
