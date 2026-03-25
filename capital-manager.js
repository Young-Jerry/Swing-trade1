(() => {
  const CASH_KEY = 'cashBalanceV1';

  function readCash() {
    const value = Number(localStorage.getItem(CASH_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function setCash(value) {
    const safe = Number(value || 0);
    localStorage.setItem(CASH_KEY, String(Number.isFinite(safe) ? safe : 0));
    updateWidgets();
    window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
  }

  function adjustCash(delta) {
    const change = Number(delta || 0);
    if (!Number.isFinite(change)) return readCash();
    const next = readCash() + change;
    setCash(next);
    return next;
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
        <strong id="topCashBalance">₨0</strong>
      </div>
      <button type="button" id="topCashEditBtn" class="btn-secondary">Update Cash</button>
    `;
    nav.appendChild(wrap);

    const btn = wrap.querySelector('#topCashEditBtn');
    btn.addEventListener('click', () => {
      const entered = prompt('Enter cash balance amount (NPR):', String(readCash()));
      if (entered === null) return;
      const parsed = Number.parseFloat(entered);
      if (!Number.isFinite(parsed)) return;
      setCash(parsed);
    });
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
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
  }

  window.PmsCapital = {
    CASH_KEY,
    readCash,
    setCash,
    adjustCash,
    investedCapital,
    updateWidgets,
  };

  const ready = () => {
    renderTopWidget();
    updateWidgets();
    window.addEventListener('storage', (event) => {
      if (event.key === CASH_KEY) updateWidgets();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
})();
