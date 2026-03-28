(() => {
  const CASH_KEY = 'cashBalanceV1';
  const LEDGER_KEY = 'cashLedgerV1';

  function normalizeMoney(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.abs(n) < 1e-9 ? 0 : n;
  }

  function readCash() {
    const value = Number(localStorage.getItem(CASH_KEY) || 0);
    return normalizeMoney(value);
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
    const safe = normalizeMoney(value);
    localStorage.setItem(CASH_KEY, String(safe));
    updateWidgets();
    window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
  }

  function adjustCash(delta, meta = {}) {
    const change = Number(delta || 0);
    if (!Number.isFinite(change) || change === 0) return readCash();

    const current = readCash();
    const next = current + change;
    if (next < 0) {
      showCashAlert('Not enough cash balance.');
      return current;
    }
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
    const nextCash = readCash() - oldDelta + safeNextDelta;
    if (nextCash < 0) {
      showCashAlert('Not enough cash balance.');
      return;
    }
    saveLedger(ledger);
    setCash(nextCash);
  }

  function deleteLedgerEntry(id) {
    const ledger = readLedger();
    const index = ledger.findIndex((row) => row.id === id);
    if (index < 0) return;
    const [removed] = ledger.splice(index, 1);
    const nextCash = readCash() - Number(removed.delta || 0);
    if (nextCash < 0) {
      showCashAlert('Not enough cash balance.');
      return;
    }
    saveLedger(ledger);
    setCash(nextCash);
  }

  function clearLedgerHistory() {
    saveLedger([]);
    window.dispatchEvent(new CustomEvent('pms-cash-updated', { detail: { cash: readCash() } }));
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
    if (!nav) return;

    const logo = nav.querySelector('.logo');
    if (logo) {
      logo.innerHTML = `
        <div class="logo-main">PMS</div>
        <div class="market-timer" id="marketTimer">⏱️ <span class="market-dot market-dot-red"></span> NEPSE Time --:--:--</div>
      `;
    }

    if (!nav.querySelector('.cash-widget')) {
      const wrap = document.createElement('a');
      wrap.className = 'cash-widget cash-widget-link';
      wrap.href = 'cash_ledger.html';
      wrap.title = 'Open cash ledger';
      wrap.setAttribute('aria-label', 'Open cash ledger');
      wrap.innerHTML = `<strong id="topCashBalance">Cash Balance Rs 0</strong>`;
      nav.appendChild(wrap);
    }

    startMarketTimer();
  }

  function startMarketTimer() {
    const timerNode = document.getElementById('marketTimer');
    if (!timerNode || timerNode.dataset.bound === '1') return;
    timerNode.dataset.bound = '1';

    const tick = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const day = now.getDay();
      const inPremarket = day !== 5 && day !== 6 && hours === 10 && minutes >= 45;
      const inMarket = day !== 5 && day !== 6 && (hours >= 11 && hours < 15);
      const stateClass = inMarket ? 'market-dot-green' : inPremarket ? 'market-dot-orange' : 'market-dot-red';
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');
      timerNode.innerHTML = `<span class="market-dot ${stateClass}"></span> NEPSE Time ${hh}:${mm}:${ss}`;
    };

    tick();
    setInterval(tick, 1000);
  }

  function updateWidgets() {
    const topNode = document.getElementById('topCashBalance');
    if (topNode) topNode.textContent = `Cash Balance Rs ${roundedCash(readCash())}`;

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

  function roundedCash(value) {
    const amount = Number(value || 0);
    if (amount <= 0) return 0;
    return Math.ceil(amount);
  }

  function money(value) {
    const rounded = Number(value || 0);
    return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(rounded)}`;
  }



  function showCashAlert(message) {
    const text = String(message || 'Not enough cash balance.');
    const existing = document.querySelector('.pms-inline-alert');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal pms-inline-alert';
    backdrop.innerHTML = `
      <section class="card modal-card">
        <h3>Cash Balance Alert</h3>
        <p class="subtitle">${escapeHtml(text)}</p>
        <div class="toolbar" style="justify-content:flex-end; margin-top:10px;">
          <button class="btn-primary" type="button" data-close-alert="true">Okay</button>
        </div>
      </section>
    `;

    backdrop.querySelector('[data-close-alert="true"]').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  window.PmsCapital = {
    CASH_KEY,
    LEDGER_KEY,
    readCash,
    setCash,
    adjustCash,
    readLedger,
    updateLedgerEntry,
    deleteLedgerEntry,
    clearLedgerHistory,
    investedCapital,
    updateWidgets,
    showCashAlert,
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
