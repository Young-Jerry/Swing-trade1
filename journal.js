(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;
    const key = 'journals';
    const MIN_DATE = new Date('2026-03-25T00:00:00');
    const today = stripTime(new Date());
    let currentDate = new Date(today);
    if (currentDate < MIN_DATE) currentDate = new Date(MIN_DATE);

    const dateNode = document.getElementById('journalDate');
    const numericDateNode = document.getElementById('journalNumericDate');
    const datePicker = document.getElementById('journalDatePicker');
    const prompts = [
      { id: 'journalQ1', key: 'learned' },
      { id: 'journalQ2', key: 'assumedWithoutProof' },
      { id: 'journalQ3', key: 'overconfident' },
      { id: 'journalQ4', key: 'unnecessaryDoubt' },
      { id: 'journalQ5', key: 'emotionalTriggers' },
      { id: 'journalQ6', key: 'didWell' },
      { id: 'journalQ7', key: 'improveTomorrow' }
    ];
    const textNodes = prompts.map((prompt) => ({ ...prompt, node: document.getElementById(prompt.id) }));
    const savedNode = document.getElementById('journalSaved');
    const prevBtn = document.getElementById('prevDay');
    const nextBtn = document.getElementById('nextDay');
    let timer;

    const store = readStore();
    ensureEntry(currentDate);
    initPicker();
    render();

    prevBtn.addEventListener('click', () => {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - 1);
      currentDate = clampDate(next);
      render();
    });

    nextBtn.addEventListener('click', () => {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 1);
      currentDate = clampDate(next);
      render();
    });

    datePicker.addEventListener('change', () => {
      const picked = new Date(`${datePicker.value}T00:00:00`);
      if (Number.isNaN(picked.getTime())) return;
      currentDate = clampDate(picked);
      render();
    });

    textNodes.forEach(({ key: promptKey, node }) => {
      if (!node) return;
      node.addEventListener('input', () => {
        const entry = ensureEntry(currentDate);
        entry[promptKey] = node.value;
        persistStore();
      });
    });

    function initPicker() {
      datePicker.min = toInputDate(MIN_DATE);
      datePicker.max = toInputDate(today);
    }

    function render() {
      currentDate = clampDate(currentDate);
      ensureEntry(currentDate);
      const entry = ensureEntry(currentDate);
      dateNode.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      if (numericDateNode) numericDateNode.textContent = toInputDate(currentDate).replaceAll('-', '/');
      datePicker.value = toInputDate(currentDate);
      textNodes.forEach(({ key: promptKey, node }) => {
        if (!node) return;
        node.value = entry[promptKey] || '';
      });

      prevBtn.disabled = stripTime(currentDate).getTime() === MIN_DATE.getTime();
      nextBtn.disabled = stripTime(currentDate).getTime() === today.getTime();
    }

    function clampDate(d) {
      const dt = stripTime(d);
      if (dt < MIN_DATE) return new Date(MIN_DATE);
      if (dt > today) return new Date(today);
      return dt;
    }

    function readStore() {
      return JSON.parse(localStorage.getItem(key) || '{}');
    }

    function ensureEntry(d) {
      const k = dateKey(d);
      const value = store[k];
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        store[k] = buildEntry(typeof value === 'string' ? value : '');
        persistStore();
      }
      return store[k];
    }

    function buildEntry(legacyText = '') {
      return {
        learned: legacyText,
        assumedWithoutProof: '',
        overconfident: '',
        unnecessaryDoubt: '',
        emotionalTriggers: '',
        didWell: '',
        improveTomorrow: ''
      };
    }

    function persistStore() {
      localStorage.setItem(key, JSON.stringify(store));
      savedNode.textContent = 'Saving...';
      clearTimeout(timer);
      timer = setTimeout(() => (savedNode.textContent = 'Saved ✓'), 350);
    }

    function dateKey(d) {
      return toInputDate(d);
    }

    function toInputDate(d) {
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    function stripTime(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
