(() => {
  const key = 'journals';
  const today = stripTime(new Date());
  let currentDate = new Date(today);
  const dateNode = document.getElementById('journalDate');
  const textNode = document.getElementById('journalText');
  const savedNode = document.getElementById('journalSaved');
  const prevBtn = document.getElementById('prevDay');
  const nextBtn = document.getElementById('nextDay');
  let timer;

  const store = readStore();
  ensureTodayEntry();
  render();

  prevBtn.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    render();
  });

  nextBtn.addEventListener('click', () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    if (next > today) return;
    currentDate = next;
    render();
  });

  textNode.addEventListener('input', () => {
    store[dateKey(currentDate)] = textNode.value;
    localStorage.setItem(key, JSON.stringify(store));
    savedNode.textContent = 'Saving...';
    clearTimeout(timer);
    timer = setTimeout(() => (savedNode.textContent = 'Saved ✓'), 350);
  });

  function render() {
    const k = dateKey(currentDate);
    if (!store[k]) store[k] = '';
    dateNode.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    textNode.value = store[k];
    nextBtn.disabled = stripTime(currentDate).getTime() === today.getTime();
  }

  function readStore() {
    return JSON.parse(localStorage.getItem(key) || '{}');
  }

  function ensureTodayEntry() {
    const k = dateKey(today);
    if (store[k] === undefined) {
      store[k] = '';
      localStorage.setItem(key, JSON.stringify(store));
    }
  }

  function dateKey(d) {
    return d.toISOString().slice(0, 10);
  }

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
})();
