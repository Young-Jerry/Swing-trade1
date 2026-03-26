(() => {
  const CASH_KEY = 'cashBalanceV1';
  const LEDGER_KEY = 'cashLedgerV1';

  function readCash() {
    const value = Number(localStorage.getItem(CASH_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function readLedger() {
    try {
      const rows = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function saveLedger(rows) {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
  }

  function setCash(value) {
    const safe = Number(value || 0);
    localStorage.setItem(CASH_KEY, String(Number.isFinite(safe) ? safe : 0));
    updateWidgets();
    window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
  }

  function adjustCash(delta, meta = {}) {
    const change = Number(delta || 0);
    if (!Number.isFinite(change) || change === 0) return readCash();

    const next = readCash() + change;
    setCash(next);

    const ledger = readLedger();
    ledger.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      delta: change,
      source: String(meta.source || 'System Auto Entry'),
      note: String(meta.note || ''),
      type: String(meta.type || (change >= 0 ? 'credit' : 'debit')),
      kind: String(meta.kind || 'system'),
      editable: Boolean(meta.editable),
    });
    saveLedger(ledger);
    return next;
  }

  function updateLedgerEntry(id, patch = {}) {
    const ledger = readLedger();
    const index = ledger.findIndex((row) => row.id === id);
    if (index < 0) return;
    const current = ledger[index];
    const oldDelta = Number(current.delta || 0);
    const nextDelta = Number(patch.delta);
    const safeNextDelta = Number.isFinite(nextDelta) ? nextDelta : oldDelta;

    ledger[index] = {
      ...current,
      ...patch,
      delta: safeNextDelta,
      updatedAt: new Date().toISOString(),
    };
    saveLedger(ledger);
    setCash(readCash() - oldDelta + safeNextDelta);
  }

  function investedCapital() {
    const trades = readRows('trades');
    const longterm = readRows('longterm');
    const sip = JSON.parse(localStorage.getItem('sipStateV4') || '{}');
    const sipInvested = Object.values(sip.records || {})
      .flat()
      .reduce((sum, row) => sum + Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0))), 0);

    const tradeInvested = trades.reduce((sum, row) => sum + (Number(row.wacc || 0) * Number(row.qty || 0)), 0);
    const longInvested = longterm.reduce((sum, row) => sum + (Number(row.wacc || 0) * Number(row.qty || 0)), 0);
    return tradeInvested + longInvested + sipInvested;
  }

  function renderTopWidget() {
    const nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('.cash-widget')) return;

    const wrap = document.createElement('div');
    wrap.className = 'cash-widget';
    wrap.innerHTML = `
      <div class="cash-widget-value">
        <span class="cash-widget-label">Cash Balance</span>
        <strong id="topCashBalance">Rs 0</strong>
      </div>
      <a id="topCashLedgerBtn" class="btn-cash btn-link" href="cash_ledger.html" title="Open cash ledger" aria-label="Open cash ledger">💵</a>
    `;
    nav.appendChild(wrap);
  }

  function updateWidgets() {
    const topNode = document.getElementById('topCashBalance');
    if (topNode) topNode.textContent = money(readCash());

    const dashboardCash = document.getElementById('dashboardCashBalance');
    if (dashboardCash) dashboardCash.textContent = money(readCash());

    const investedNode = document.getElementById('openInvestedCapital');
    if (investedNode) investedNode.textContent = money(investedCapital());
  }

  function readRows(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function money(value) {
    const rounded = Number(value || 0);
    return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(rounded)}`;
  }

  window.PmsCapital = {
    CASH_KEY,
    LEDGER_KEY,
    readCash,
    setCash,
    adjustCash,
    readLedger,
    updateLedgerEntry,
    investedCapital,
    updateWidgets,
  };

  const ready = () => {
    renderTopWidget();
    updateWidgets();
    window.addEventListener('storage', (event) => {
      if (event.key === CASH_KEY || event.key === LEDGER_KEY) updateWidgets();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
})();
