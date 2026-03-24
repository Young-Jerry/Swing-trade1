(function () {
  const TRADES_KEY = 'trades';
  const SIP_KEY = 'sipData';
  const SIM_KEY = 'pastTradeSimulations';

  const tradeSelect = document.getElementById('tradeSelect');
  const entryPriceInput = document.getElementById('entryPrice');
  const quantityInput = document.getElementById('quantity');
  const exitPriceInput = document.getElementById('exitPrice');
  const holdingDaysInput = document.getElementById('holdingDays');
  const analysisForm = document.getElementById('analysisForm');
  const simTableBody = document.querySelector('#simTable tbody');

  if (!tradeSelect || !analysisForm) return;

  const state = {
    mergedTrades: [],
  };

  bindEvents();
  loadTradeOptions();
  updateScenarioOutput();
  renderSimulationRows();

  function bindEvents() {
    tradeSelect.addEventListener('change', onTradeChange);
    exitPriceInput.addEventListener('input', updateScenarioOutput);
    holdingDaysInput.addEventListener('input', updateScenarioOutput);

    analysisForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const selected = getSelectedTrade();
      const exitPrice = toNum(exitPriceInput.value);
      const holdingDays = toNum(holdingDaysInput.value);
      if (!selected || !Number.isFinite(exitPrice) || !Number.isFinite(holdingDays) || holdingDays <= 0) return;

      const metrics = calculateMetrics(selected.entryPrice, exitPrice, selected.quantity, holdingDays);
      const sims = readJson(SIM_KEY);
      sims.push({
        id: crypto.randomUUID(),
        label: selected.label,
        entryPrice: selected.entryPrice,
        exitPrice,
        quantity: selected.quantity,
        holdingDays,
        pl: metrics.pl,
        pct: metrics.pct,
        daily: metrics.daily,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(SIM_KEY, JSON.stringify(sims));
      renderSimulationRows();
    });
  }

  function loadTradeOptions() {
    const trades = readJson(TRADES_KEY).map((row) => ({
      id: `trade-${row.id || crypto.randomUUID()}`,
      source: 'trade',
      label: String(row.script || 'Trade').trim() || 'Trade',
      entryPrice: toNum(row.wacc),
      quantity: toNum(row.qty),
    }));

    const sipRecords = readJson(SIP_KEY).map((row, idx) => ({
      id: `sip-${row.id || idx}`,
      source: 'sip',
      label: `SIP ${String(row.date || `#${idx + 1}`)}`,
      entryPrice: toNum(row.nav),
      quantity: toNum(row.units),
    }));

    state.mergedTrades = [...trades, ...sipRecords]
      .filter((row) => Number.isFinite(row.entryPrice) && Number.isFinite(row.quantity) && row.quantity > 0);

    tradeSelect.innerHTML = '';
    if (!state.mergedTrades.length) {
      tradeSelect.innerHTML = '<option value="">No trades found in localStorage</option>';
      entryPriceInput.value = '';
      quantityInput.value = '';
      return;
    }

    state.mergedTrades.forEach((row) => {
      const option = document.createElement('option');
      option.value = row.id;
      option.textContent = `${row.source === 'trade' ? '[Trade]' : '[SIP]'} ${row.label} | Entry: ${currency(row.entryPrice)} | Qty: ${fmtQty(row.quantity)}`;
      tradeSelect.appendChild(option);
    });

    onTradeChange();
  }

  function onTradeChange() {
    const selected = getSelectedTrade();
    if (!selected) return;
    entryPriceInput.value = String(selected.entryPrice);
    quantityInput.value = String(selected.quantity);
    updateScenarioOutput();
  }

  function getSelectedTrade() {
    return state.mergedTrades.find((row) => row.id === tradeSelect.value) || state.mergedTrades[0] || null;
  }

  function updateScenarioOutput() {
    const selected = getSelectedTrade();
    if (!selected) return;

    const exitPrice = toNum(exitPriceInput.value);
    const holdingDays = Math.max(1, toNum(holdingDaysInput.value) || 0);

    const metrics = Number.isFinite(exitPrice)
      ? calculateMetrics(selected.entryPrice, exitPrice, selected.quantity, holdingDays)
      : { pl: 0, pct: 0, daily: 0 };

    setText('outEntry', currency(selected.entryPrice));
    setText('outExit', currency(exitPrice));
    setText('outQty', fmtQty(selected.quantity));
    setText('outPL', currency(metrics.pl), metrics.pl >= 0 ? 'value-profit' : 'value-loss');
    setText('outPct', `${metrics.pct.toFixed(2)}%`, metrics.pct >= 0 ? 'value-profit' : 'value-loss');
    setText('outDays', String(Math.max(0, toNum(holdingDaysInput.value) || 0)));
    setText('outDaily', currency(metrics.daily), metrics.daily >= 0 ? 'value-profit' : 'value-loss');
  }

  function calculateMetrics(entryPrice, exitPrice, qty, days) {
    const pl = (exitPrice - entryPrice) * qty;
    const invested = entryPrice * qty;
    const pct = invested > 0 ? (pl / invested) * 100 : 0;
    const daily = days > 0 ? pl / days : 0;
    return { pl, pct, daily };
  }

  function renderSimulationRows() {
    const rows = readJson(SIM_KEY);
    simTableBody.innerHTML = '';
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(row.label || '')}</td>
        <td>${currency(row.entryPrice)}</td>
        <td>${currency(row.exitPrice)}</td>
        <td>${fmtQty(row.quantity)}</td>
        <td class="${row.pl >= 0 ? 'value-profit' : 'value-loss'}">${currency(row.pl)}</td>
        <td class="${row.pct >= 0 ? 'value-profit' : 'value-loss'}">${toNum(row.pct).toFixed(2)}%</td>
        <td>${Math.max(0, toNum(row.holdingDays) || 0)}</td>
        <td class="${row.daily >= 0 ? 'value-profit' : 'value-loss'}">${currency(row.daily)}</td>
      `;
      simTableBody.appendChild(tr);
    });
  }

  function setText(id, value, className = '') {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = value;
    node.className = className;
  }

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }

  function currency(value) {
    const number = Number.isFinite(value) ? value : 0;
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(number)}`;
  }

  function fmtQty(value) {
    const number = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(number);
  }

  function toNum(v) {
    return Number.parseFloat(v);
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
