(function () {
  const SIP_KEY = 'sipData';
  const SOLD_UNITS_KEY = 'sipSoldUnits';

  const sipForm = document.getElementById('sipForm');
  const partialExitForm = document.getElementById('partialExitForm');
  const sipBody = document.querySelector('#sipTable tbody');
  const totalInvestedNode = document.getElementById('totalInvested');
  const totalUnitsNode = document.getElementById('totalUnits');
  const remainingUnitsNode = document.getElementById('remainingUnits');
  const exitMessage = document.getElementById('exitMessage');

  if (!sipForm || !sipBody) return;

  const today = new Date().toISOString().slice(0, 10);
  sipForm.elements.date.value = today;

  bindEvents();
  render();

  function bindEvents() {
    sipForm.addEventListener('submit', onSipSubmit);
    partialExitForm.addEventListener('submit', onPartialExit);

    sipForm.querySelectorAll('[data-next]').forEach((el, idx, all) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (all[idx + 1] || sipForm.querySelector('button[type="submit"]')).focus();
        }
      });
    });
  }

  function onSipSubmit(e) {
    e.preventDefault();
    const fd = new FormData(sipForm);
    const date = String(fd.get('date') || '').trim() || today;
    const amount = toNum(fd.get('amount'));
    const nav = toNum(fd.get('nav'));

    if (!Number.isFinite(amount) || !Number.isFinite(nav) || amount <= 0 || nav <= 0) return;

    const entry = {
      id: crypto.randomUUID(),
      date,
      amount,
      nav,
      units: amount / nav,
    };

    const rows = readSipData();
    rows.push(entry);
    localStorage.setItem(SIP_KEY, JSON.stringify(rows));

    sipForm.reset();
    sipForm.elements.date.value = today;
    exitMessage.textContent = 'SIP entry saved.';
    render();
  }

  function onPartialExit(e) {
    e.preventDefault();
    const totalUnits = totalUnitsOwned();
    const toSell = toNum(partialExitForm.elements.unitsToSell.value);

    if (!Number.isFinite(toSell) || toSell <= 0) {
      exitMessage.textContent = 'Enter valid units to sell.';
      return;
    }

    if (toSell > totalUnits) {
      exitMessage.textContent = 'Units to sell cannot exceed total units owned.';
      return;
    }

    localStorage.setItem(SOLD_UNITS_KEY, String(toSell));
    partialExitForm.reset();
    exitMessage.textContent = `Partial exit applied for ${fmtUnits(toSell)} units.`;
    render();
  }

  function readSipData() {
    const raw = JSON.parse(localStorage.getItem(SIP_KEY) || '[]');
    return raw
      .map((r) => ({
        id: r.id || crypto.randomUUID(),
        date: String(r.date || ''),
        amount: toNum(r.amount),
        nav: toNum(r.nav),
        units: toNum(r.units),
      }))
      .filter((r) => Number.isFinite(r.amount) && Number.isFinite(r.nav) && Number.isFinite(r.units));
  }

  function totalUnitsOwned() {
    return readSipData().reduce((sum, row) => sum + row.units, 0);
  }

  function render() {
    const rows = readSipData().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const totalInvested = rows.reduce((sum, row) => sum + row.amount, 0);
    const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
    const soldUnits = Math.max(0, toNum(localStorage.getItem(SOLD_UNITS_KEY)) || 0);
    const remaining = Math.max(0, totalUnits - soldUnits);

    totalInvestedNode.textContent = currency(totalInvested);
    totalUnitsNode.textContent = fmtUnits(totalUnits);
    remainingUnitsNode.textContent = fmtUnits(remaining);

    sipBody.innerHTML = '';
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(row.date)}</td>
        <td>${currency(row.amount)}</td>
        <td>${fmtNav(row.nav)}</td>
        <td>${fmtUnits(row.units)}</td>
      `;
      sipBody.appendChild(tr);
    });
  }

  function toNum(v) {
    return Number.parseFloat(v);
  }

  function currency(value) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
  }

  function fmtUnits(value) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value || 0);
  }

  function fmtNav(value) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value || 0);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
