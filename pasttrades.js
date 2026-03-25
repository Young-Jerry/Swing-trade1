(function () {
  const TRADES_KEY = 'trades';
  const LONGTERM_KEY = 'longterm';
  const SIP_STATE_KEY = 'sipStateV2';
  const EXITED_KEY = 'exitedTrades';

  const activeBody = document.querySelector('#activeTradesTable tbody');
  const exitedBody = document.querySelector('#exitedTable tbody');
  if (!activeBody) return;

  render();

  function render() {
    const active = getActiveRecords();
    const exited = readJson(EXITED_KEY);

    activeBody.innerHTML = '';
    active.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.source}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${fmtQty(row.qty)}</td>
        <td>${currency(row.price)}</td>
        <td>
          <button class="btn-secondary" data-action="edit" data-id="${row.id}">Edit</button>
          <button class="btn-danger" data-action="delete" data-id="${row.id}">Delete</button>
          <button class="btn-primary" data-action="exit" data-id="${row.id}">Exit Trade</button>
        </td>
      `;
      activeBody.appendChild(tr);
    });

    exitedBody.innerHTML = '';
    exited.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.exitedAt}</td><td>${row.source}</td><td>${escapeHtml(row.name)}</td><td>${fmtQty(row.qty)}</td><td>${currency(row.price)}</td>`;
      exitedBody.appendChild(tr);
    });

    activeBody.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
    });
  }

  function handleAction(action, id) {
    const active = getActiveRecords();
    const record = active.find((r) => r.id === id);
    if (!record) return;

    if (action === 'edit') {
      const qty = prompt('New Qty/Units', String(record.qty));
      const price = prompt('New WACC/NAV', String(record.price));
      if (qty === null || price === null) return;
      updateRecord(record, Number(qty), Number(price));
      render();
      return;
    }

    if (action === 'delete') {
      removeRecord(record);
      render();
      return;
    }

    if (action === 'exit') {
      const exited = readJson(EXITED_KEY);
      exited.push({ ...record, exitedAt: new Date().toISOString().slice(0, 10) });
      localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
      removeRecord(record);
      render();
    }
  }

  function getActiveRecords() {
    const tradeRows = readJson(TRADES_KEY).map((row) => ({
      id: `t-${row.id}`,
      rawId: row.id,
      source: 'Trades',
      name: row.script || 'Trade',
      qty: Number(row.qty || 0),
      price: Number(row.wacc || 0),
      ref: 'trades',
    }));

    const longTermRows = readJson(LONGTERM_KEY).map((row) => ({
      id: `l-${row.id}`,
      rawId: row.id,
      source: 'Long Term',
      name: row.script || 'Holding',
      qty: Number(row.qty || 0),
      price: Number(row.wacc || 0),
      ref: 'longterm',
    }));

    const sipState = JSON.parse(localStorage.getItem(SIP_STATE_KEY) || '{}');
    const sipRows = [];
    Object.entries(sipState.records || {}).forEach(([sipName, rows]) => {
      rows.forEach((row) => {
        sipRows.push({
          id: `s-${sipName}-${row.id}`,
          rawId: row.id,
          sipName,
          source: 'SIP',
          name: sipName,
          qty: Number(row.units || 0),
          price: Number(row.nav || 0),
          ref: 'sip',
        });
      });
    });

    return [...tradeRows, ...longTermRows, ...sipRows];
  }

  function updateRecord(record, qty, price) {
    if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price <= 0) return;

    if (record.ref === 'trades' || record.ref === 'longterm') {
      const storageKey = record.ref === 'trades' ? TRADES_KEY : LONGTERM_KEY;
      const rows = readJson(storageKey);
      const row = rows.find((r) => r.id === record.rawId);
      if (!row) return;
      row.qty = qty;
      row.wacc = price;
      localStorage.setItem(storageKey, JSON.stringify(rows));
      return;
    }

    const sipState = JSON.parse(localStorage.getItem(SIP_STATE_KEY) || '{}');
    const rows = sipState.records?.[record.sipName] || [];
    const row = rows.find((r) => r.id === record.rawId);
    if (!row) return;
    row.units = qty;
    row.nav = price;
    row.amount = qty * price;
    localStorage.setItem(SIP_STATE_KEY, JSON.stringify(sipState));
  }

  function removeRecord(record) {
    if (record.ref === 'trades' || record.ref === 'longterm') {
      const storageKey = record.ref === 'trades' ? TRADES_KEY : LONGTERM_KEY;
      const rows = readJson(storageKey).filter((r) => r.id !== record.rawId);
      localStorage.setItem(storageKey, JSON.stringify(rows));
      return;
    }

    const sipState = JSON.parse(localStorage.getItem(SIP_STATE_KEY) || '{}');
    sipState.records[record.sipName] = (sipState.records[record.sipName] || []).filter((r) => r.id !== record.rawId);
    localStorage.setItem(SIP_STATE_KEY, JSON.stringify(sipState));
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }

  function fmtQty(value) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value || 0);
  }

  function currency(value) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
