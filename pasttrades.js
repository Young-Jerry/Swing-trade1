(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;
    const TRADES_KEY = 'trades';
    const LONGTERM_KEY = 'longterm';
    const EXITED_KEY = 'exitedTradesV2';

    const exitForm = document.getElementById('exitForm');
    const exitType = document.getElementById('exitType');
    const exitRecord = document.getElementById('exitRecord');
    const soldPriceInput = document.getElementById('soldPrice');
    const holdingDaysInput = document.getElementById('holdingDays');
    const exitedBody = document.querySelector('#exitedTable tbody');
    const pastTradeFilter = document.getElementById('pastTradeFilter');

    if (!exitForm || !exitType || !exitRecord || !soldPriceInput || !exitedBody) return;

    bindEvents();
    renderRecordOptions();
    renderExited();

    function bindEvents() {
      exitType.addEventListener('change', renderRecordOptions);
      if (pastTradeFilter) pastTradeFilter.addEventListener('input', renderExited);

      exitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = exitType.value;
        const recordId = exitRecord.value;
        const soldPrice = Number(soldPriceInput.value);
        const holdingDays = Math.floor(Number(holdingDaysInput.value));
        if (!recordId || !Number.isFinite(soldPrice) || soldPrice <= 0 || !Number.isFinite(holdingDays) || holdingDays < 0) return;

        const active = getActiveRecords(type);
        const record = active.find((item) => item.id === recordId);
        if (!record) return;

        const roundTrip = tradeMath().calculateRoundTrip({
          buyPrice: record.buyPrice,
          soldPrice,
          qty: record.qty,
        });
        const grossProfit = Number(roundTrip.grossProfit || roundTrip.profit || 0);
        const capitalGainTax = Number(roundTrip.capitalGainTax || 0);
        const profit = Number(roundTrip.netProfit || roundTrip.profit || 0);
        const perDayProfit = holdingDays > 0 ? profit / holdingDays : profit;

        const exited = readJson(EXITED_KEY);
        exited.push({
          id: crypto.randomUUID(),
          exitedAt: new Date().toISOString(),
          type: record.source,
          name: record.name,
          qty: record.qty,
          buyPrice: record.buyPrice,
          soldPrice,
          buyTotal: roundTrip.invested,
          soldTotal: roundTrip.realizedAmount,
          netSoldTotal: Number(roundTrip.netRealizedAmount || roundTrip.realizedAmount || 0),
          grossProfit,
          capitalGainTax,
          profit,
          perDayProfit,
          holdingDays,
        });

        localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
        if (window.PmsCapital) window.PmsCapital.adjustCash(Number(roundTrip.netRealizedAmount || roundTrip.realizedAmount || 0));
        removeRecord(record);
        soldPriceInput.value = '';
        holdingDaysInput.value = '';
        renderRecordOptions();
        renderExited();
      });
    }

    function renderRecordOptions() {
      const type = exitType.value;
      const records = getActiveRecords(type);

      exitRecord.innerHTML = records
        .map((row) => `<option value="${row.id}">${escapeHtml(row.name)} — Qty/Units: ${fmtQty(row.qty)}</option>`)
        .join('');

      if (!records.length) {
        exitRecord.innerHTML = '<option value="">No records available</option>';
      }
    }

    function renderExited() {
      const exited = readJson(EXITED_KEY);
      exitedBody.innerHTML = '';

      const keyword = String(pastTradeFilter ? pastTradeFilter.value : '').trim().toLowerCase();
      exited
        .filter((row) => !keyword || String(row.name || '').toLowerCase().includes(keyword))
        .forEach((row) => {
        const normalized = normalizeExited(row);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${normalized.type}</td>
          <td>${escapeHtml(normalized.name)}</td>
          <td>${currency(normalized.buyPrice)}</td>
          <td>${currency(normalized.soldPrice || normalized.currentPrice || 0)}</td>
          <td class="${profitClass(normalized.profit)}">${currency(normalized.profit)}<div class="subtitle">Tax: ${currency(normalized.capitalGainTax || 0)}</div></td>
          <td class="${profitClass(normalized.moneyReceivable)}">${currency(normalized.moneyReceivable)}</td>
          <td>${Math.floor(Number(normalized.holdingDays || 0))}</td>
          <td class="actions-cell">
            <button class="btn-secondary" data-action="edit" data-id="${normalized.id}">✏️</button>
            <button class="btn-danger" data-action="delete" data-id="${normalized.id}">🗑️</button>
          </td>
        `;
        exitedBody.appendChild(tr);
      });

      exitedBody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => editExited(btn.dataset.id));
      });

      exitedBody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', () => deleteExited(btn.dataset.id));
      });

      if (window.PmsAllocation) {
        window.PmsAllocation.renderAllocation('pastTradesAllocation', exited.map((row) => ({
          script: row.name,
          value: Number(row.netSoldTotal || row.soldTotal || 0),
        })));
      }

      if (!exited.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="8">No exited trades yet.</td>';
        exitedBody.appendChild(tr);
      }
    }

    function editExited(id) {
      const exited = readJson(EXITED_KEY);
      const row = exited.find((item) => item.id === id);
      if (!row) return;
      const normalized = normalizeExited(row);
      const backdrop = buildModal({
        title: `Edit ${normalized.name}`,
        subtitle: 'Update holding days.',
        body: `
          <label>Holding Days
            <input type="number" min="0" step="1" data-field="holdingDays" value="${normalized.holdingDays}" />
          </label>
        `,
        actions: `<button class="btn-primary" type="button" data-confirm="true">Save</button>`,
      });
      const card = backdrop.querySelector('.modal-card');
      card.querySelector('[data-confirm="true"]').addEventListener('click', () => {
        const parsed = Math.floor(Number(card.querySelector('[data-field="holdingDays"]').value));
        if (!Number.isFinite(parsed) || parsed < 0) return;
        row.holdingDays = parsed;
        row.profit = normalized.profit;
        row.capitalGainTax = normalized.capitalGainTax;
        row.perDayProfit = parsed > 0 ? normalized.profit / parsed : normalized.profit;
        row.netSoldTotal = normalized.netSoldTotal;
        localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
        renderExited();
        backdrop.remove();
      });
    }

    function deleteExited(id) {
      const backdrop = buildModal({
        title: 'Delete Exited Trade',
        subtitle: 'This will remove the record and reverse the credited cash.',
        body: '',
        actions: `<button class="btn-danger" type="button" data-confirm="true">Delete</button>`,
      });
      backdrop.querySelector('[data-confirm="true"]').addEventListener('click', () => {
        const current = readJson(EXITED_KEY);
        const target = current.find((row) => row.id === id);
        if (target && window.PmsCapital) window.PmsCapital.adjustCash(-Number(target.netSoldTotal || target.soldTotal || 0));
        const exited = current.filter((row) => row.id !== id);
        localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
        renderExited();
        backdrop.remove();
      });
    }

    function getActiveRecords(type) {
      const builders = {
        trades: () => readJson(TRADES_KEY).map((row) => ({
          id: `t-${row.id}`,
          rawId: row.id,
          source: 'Trade',
          name: row.script || 'Trade',
          qty: Number(row.qty || 0),
          buyPrice: Number(row.wacc || 0),
          currentPrice: Number(row.ltp || 0),
          ref: 'trades',
        })),
        longterm: () => readJson(LONGTERM_KEY).map((row) => ({
          id: `l-${row.id}`,
          rawId: row.id,
          source: 'Long Term',
          name: row.script || 'Holding',
          qty: Number(row.qty || 0),
          buyPrice: Number(row.wacc || 0),
          currentPrice: Number(row.ltp || 0),
          ref: 'longterm',
        })),
      };

      return (builders[type] || (() => []))();
    }

    function removeRecord(record) {
      if (record.ref === 'trades' || record.ref === 'longterm') {
        const storageKey = record.ref === 'trades' ? TRADES_KEY : LONGTERM_KEY;
        const rows = readJson(storageKey).filter((r) => r.id !== record.rawId);
        localStorage.setItem(storageKey, JSON.stringify(rows));
        return;
      }

    }


    function tradeMath() {
      return window.PmsTradeMath || {
        calculateRoundTrip: ({ buyPrice, soldPrice, qty }) => ({
          invested: Number(buyPrice || 0) * Number(qty || 0),
          realizedAmount: Number(soldPrice || 0) * Number(qty || 0),
          profit: (Number(soldPrice || 0) - Number(buyPrice || 0)) * Number(qty || 0),
        }),
      };
    }

    function normalizeExited(row) {
      const calc = tradeMath().calculateRoundTrip({
        buyPrice: row.buyPrice,
        soldPrice: row.soldPrice || row.currentPrice || 0,
        qty: row.qty,
      });
      const profit = Number(calc.netProfit || calc.profit || row.profit || 0);
      const capitalGainTax = Number(calc.capitalGainTax || row.capitalGainTax || 0);
      const holdingDays = Math.floor(Number(row.holdingDays || 0));
      return {
        ...row,
        capitalGainTax,
        profit,
        buyTotal: Number(calc.invested || row.buyTotal || 0),
        netSoldTotal: Number(calc.netRealizedAmount || row.netSoldTotal || row.soldTotal || 0),
        perDayProfit: holdingDays > 0 ? profit / holdingDays : profit,
        moneyReceivable: Number(calc.invested || row.buyTotal || 0) + profit,
        holdingDays,
      };
    }

    function buildModal({ title, subtitle, body, actions }) {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal modal-fullscreen';
      const card = document.createElement('section');
      card.className = 'card modal-card';
      card.innerHTML = `
        <div class="toolbar modal-head">
          <div>
            <h3>${title}</h3>
            ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
          </div>
          <button type="button" class="btn-danger" data-close="true">Close</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="toolbar modal-actions">${actions || ''}</div>
      `;
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);
      card.querySelector('[data-close="true"]').addEventListener('click', () => backdrop.remove());
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
      return backdrop;
    }

    function readJson(key) {
      try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
    }

    function fmtQty(value) {
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0);
    }

    function currency(value) {
      return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
    }

    function profitClass(value) {
      return Number(value || 0) >= 0 ? 'value-profit' : 'value-loss';
    }

    function escapeHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
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
