(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;
    const TRADES_KEY = 'trades';
    const LONGTERM_KEY = 'longterm';
    const SIP_STATE_KEY = 'sipStateV4';
    const SIP_STATE_V3_KEY = 'sipStateV3';
    const SIP_STATE_OLD_KEY = 'sipStateV2';
    const EXITED_KEY = 'exitedTradesV2';

    const exitForm = document.getElementById('exitForm');
    const exitType = document.getElementById('exitType');
    const exitRecord = document.getElementById('exitRecord');
    const soldPriceInput = document.getElementById('soldPrice');
    const holdingDaysInput = document.getElementById('holdingDays');
    const exitedBody = document.querySelector('#exitedTable tbody');

    if (!exitForm || !exitType || !exitRecord || !soldPriceInput || !exitedBody) return;

    bindEvents();
    renderRecordOptions();
    renderExited();

    function bindEvents() {
      exitType.addEventListener('change', renderRecordOptions);

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

        const profit = (soldPrice - record.buyPrice) * record.qty;
        const perDayProfit = holdingDays > 0 ? profit / holdingDays : profit;

        const exited = readJson(EXITED_KEY);
        exited.push({
          id: crypto.randomUUID(),
          type: record.source,
          name: record.name,
          qty: record.qty,
          buyPrice: record.buyPrice,
          soldPrice,
          profit,
          perDayProfit,
          holdingDays,
        });

        localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
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

      exited.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.type}</td>
          <td>${escapeHtml(row.name)}</td>
          <td>${currency(row.buyPrice)}</td>
          <td>${currency(row.soldPrice || row.currentPrice || 0)}</td>
          <td class="${profitClass(row.profit)}">${currency(row.profit)}</td>
          <td class="${profitClass(row.perDayProfit)}">${currency(row.perDayProfit)}</td>
          <td>${Math.floor(Number(row.holdingDays || 0))}</td>
          <td class="actions-cell">
            <button class="btn-secondary" data-action="edit" data-id="${row.id}">Edit</button>
            <button class="btn-danger" data-action="delete" data-id="${row.id}">Delete</button>
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

      const holdingDays = prompt('Holding Days', String(row.holdingDays));
      if (holdingDays === null) return;
      const parsed = Math.floor(Number(holdingDays));
      if (!Number.isFinite(parsed) || parsed < 0) return;

      row.holdingDays = parsed;
      row.perDayProfit = parsed > 0 ? row.profit / parsed : row.profit;
      localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
      renderExited();
    }

    function deleteExited(id) {
      const exited = readJson(EXITED_KEY).filter((row) => row.id !== id);
      localStorage.setItem(EXITED_KEY, JSON.stringify(exited));
      renderExited();
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
        sip: () => {
          const sipState = JSON.parse(localStorage.getItem(SIP_STATE_KEY) || localStorage.getItem(SIP_STATE_V3_KEY) || localStorage.getItem(SIP_STATE_OLD_KEY) || '{}');
          const rows = [];
          Object.entries(sipState.records || {}).forEach(([sipName, records]) => {
            records.forEach((row) => {
              rows.push({
                id: `s-${sipName}-${row.id}`,
                rawId: row.id,
                sipName,
                source: 'SIP',
                name: sipName,
                qty: Number(row.units || 0),
                buyPrice: Number(row.nav || 0),
                currentPrice: Number((sipState.currentNav || {})[sipName] || row.nav || 0),
                ref: 'sip',
              });
            });
          });
          return rows;
        },
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

      const key = localStorage.getItem(SIP_STATE_KEY)
        ? SIP_STATE_KEY
        : (localStorage.getItem(SIP_STATE_V3_KEY) ? SIP_STATE_V3_KEY : SIP_STATE_OLD_KEY);
      const sipState = JSON.parse(localStorage.getItem(key) || '{}');
      sipState.records = sipState.records || {};
      sipState.records[record.sipName] = (sipState.records[record.sipName] || []).filter((r) => r.id !== record.rawId);
      localStorage.setItem(key, JSON.stringify(sipState));
    }

    function readJson(key) {
      try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
    }

    function fmtQty(value) {
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0);
    }

    function currency(value) {
      return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
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
