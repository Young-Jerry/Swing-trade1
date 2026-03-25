(() => {
  const key = 'journals';
  const MIN_DATE = new Date('2026-03-25T00:00:00');
  const today = stripTime(new Date());
  let currentDate = new Date(today);
  if (currentDate < MIN_DATE) currentDate = new Date(MIN_DATE);

  const dateNode = document.getElementById('journalDate');
  const datePicker = document.getElementById('journalDatePicker');
  const textNode = document.getElementById('journalText');
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

  textNode.addEventListener('input', () => {
    store[dateKey(currentDate)] = textNode.value;
    localStorage.setItem(key, JSON.stringify(store));
    savedNode.textContent = 'Saving...';
    clearTimeout(timer);
    timer = setTimeout(() => (savedNode.textContent = 'Saved ✓'), 350);
  });

  function initPicker() {
    datePicker.min = toInputDate(MIN_DATE);
    datePicker.max = toInputDate(today);
  }

  function render() {
    currentDate = clampDate(currentDate);
    ensureEntry(currentDate);
    const k = dateKey(currentDate);
    dateNode.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    datePicker.value = toInputDate(currentDate);
    textNode.value = store[k] || '';

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
    if (store[k] === undefined) {
      store[k] = '';
      localStorage.setItem(key, JSON.stringify(store));
    }
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
})();
