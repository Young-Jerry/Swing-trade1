(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;
    const STORAGE_KEY = 'pmsInputDatabaseV1';
    const pageKey = location.pathname.split('/').pop() || 'index.html';

    document.addEventListener('DOMContentLoaded', () => {
      restoreInputs();
      bindTracking();
    });

    function restoreInputs() {
      const state = readState();
      const saved = state[pageKey] || {};

      allInputs().forEach((el) => {
        const key = inputKey(el);
        if (!key || saved[key] === undefined) return;
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = Boolean(saved[key]);
        } else {
          el.value = String(saved[key]);
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    function bindTracking() {
      const handler = (event) => {
        const el = event.target;
        if (!(el instanceof HTMLElement)) return;
        if (!isTrackable(el)) return;
        const key = inputKey(el);
        if (!key) return;
        saveField(key, el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value);
      };
      document.addEventListener('input', handler);
      document.addEventListener('change', handler);
    }

    function saveField(key, value) {
      const state = readState();
      state[pageKey] = state[pageKey] || {};
      state[pageKey][key] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function allInputs() {
      return [...document.querySelectorAll('input, select, textarea')].filter(isTrackable);
    }

    function isTrackable(el) {
      if (el.closest('[data-no-persist="true"]')) return false;
      if (el.closest('#addForm, #installmentForm, #manualSipForm, #navForm')) return false;
      return !el.readOnly
        && !el.disabled
        && !['button', 'submit', 'reset', 'image', 'file', 'hidden'].includes(el.type);
    }

    function inputKey(el) {
      const formId = el.form?.id || 'nofrm';
      return el.name || el.id || `${formId}:${el.type}:${indexInForm(el)}`;
    }

    function indexInForm(el) {
      const list = el.form ? [...el.form.querySelectorAll('input, select, textarea')] : allInputs();
      return Math.max(0, list.indexOf(el));
    }

    function readState() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
      } catch {
        return {};
      }
    }
  };

  const ready = window.__pmsDataReady;
  if (ready && typeof ready.then === 'function') {
    ready.finally(boot);
  } else {
    window.addEventListener('pms-data-ready', boot, { once: true });
    setTimeout(boot, 1200);
  }
})();
