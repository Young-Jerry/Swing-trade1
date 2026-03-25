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
      tr.className = 'operator-row';
      tr.innerHTML = `
        <td><button class="btn-secondary" data-action="toggle" data-id="${row.id}">Row Operator</button></td>
        <td>${row.source}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${fmtQty(row.qty)}</td>
        <td>${currency(row.price)}</td>
      `;
      activeBody.appendChild(tr);

      const detail = document.createElement('tr');
      detail.className = 'operator-detail hidden';
      detail.dataset.id = row.id;
      detail.innerHTML = `
        <td colspan="5">
          <div class="actions-cell">
            <button class="btn-primary" data-action="exit" data-id="${row.id}">Exit Trade</button>
          </div>
        </td>
      `;
      activeBody.appendChild(detail);
    });

    exitedBody.innerHTML = '';
    exited.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.source}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${fmtQty(row.qty)}</td>
        <td>${currency(row.price)}</td>
        <td>${holdingDays(row.openedAt, row.exitedAt)} days</td>
        <td><button class="btn-danger" data-action="removeExited" data-id="${row.id}">Remove</button></td>
      `;
      exitedBody.appendChild(tr);
    });

    document.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
    });
  }

  function handleAction(action, id) {
    if (action === 'toggle') {
      const detail = activeBody.querySelector(`tr.operator-detail[data-id="${id}"]`);
      if (detail) detail.classList.toggle('hidden');
      return;
    }

    if (action === 'removeExited') {
      const exited = readJson(EXITED_KEY).filter((row) => row.id !== id);
      localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
      render();
      return;
    }

    if (action !== 'exit') return;

    const active = getActiveRecords();
    const record = active.find((r) => r.id === id);
    if (!record) return;

    const exited = readJson(EXITED_KEY);
    exited.push({ ...record, exitedAt: new Date().toISOString() });
    localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
    removeRecord(record);
    render();
  }

  function getActiveRecords() {
    const tradeRows = readJson(TRADES_KEY).map((row) => ({
      id: `t-${row.id}`,
      rawId: row.id,
      source: 'Trades',
      name: row.script || 'Trade',
      qty: Number(row.qty || 0),
      price: Number(row.wacc || 0),
      openedAt: row.createdAt || row.id,
      ref: 'trades',
    }));

    const longTermRows = readJson(LONGTERM_KEY).map((row) => ({
      id: `l-${row.id}`,
      rawId: row.id,
      source: 'Long Term',
      name: row.script || 'Holding',
      qty: Number(row.qty || 0),
      price: Number(row.wacc || 0),
      openedAt: row.createdAt || row.id,
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
          openedAt: row.date,
          ref: 'sip',
        });
      });
    });

    return [...tradeRows, ...longTermRows, ...sipRows];
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

  function holdingDays(openedAt, exitedAt) {
    const start = new Date(openedAt);
    const end = new Date(exitedAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;
    const ms = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(ms / 86400000));
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
