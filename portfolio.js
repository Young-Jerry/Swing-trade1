(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;
    const pageRoot = document.querySelector('[data-portfolio-key]');
    if (!pageRoot) return;

    const storageKey = pageRoot.dataset.portfolioKey;
    const showRanges = pageRoot.dataset.showRanges === 'true';
    const tableBody = document.querySelector('#portfolioTable tbody');
    const form = document.getElementById('addForm');
    const indicator = document.getElementById('saveIndicator');
    const scriptFilter = document.getElementById('scriptFilter');

    let sortKey = 'script';
    let sortDir = 1;
    let rows = readRows();
    let indicatorTimer;

    bindEvents();
    clearEntryForm();
    render();

    function bindEvents() {
      form.addEventListener('submit', onSubmit);
      document.querySelectorAll('th[data-sort]').forEach((th) => {
        if (th.dataset.sort === 'actions') return;
        th.addEventListener('click', () => {
          const key = th.dataset.sort;
          if (sortKey === key) sortDir *= -1;
          else {
            sortKey = key;
            sortDir = 1;
          }
          render();
        });
      });
      const massBtn = document.getElementById('massEditBtn');
      if (massBtn) massBtn.addEventListener('click', openMassEdit);
      if (scriptFilter) scriptFilter.addEventListener('input', render);
      window.addEventListener('pms-ltp-updated', () => {
        rows = readRows();
        render();
      });
      window.addEventListener('storage', (event) => {
        if (!event || event.key === storageKey) {
          rows = readRows();
          render();
        }
      });

    }

    function clearEntryForm() {
      form.reset();
      form.querySelectorAll('input, select, textarea').forEach((el) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
          else el.value = '';
        } else if (el instanceof HTMLSelectElement) {
          el.selectedIndex = 0;
        }
      });
    }

    function onSubmit(e) {
      e.preventDefault();
      const fd = new FormData(form);
      const record = {
        id: crypto.randomUUID(),
        script: clean(fd.get('script')).toUpperCase(),
        ltp: num(fd.get('ltp')),
        qty: num(fd.get('qty')),
        wacc: num(fd.get('wacc')),
        sell1: showRanges ? num(fd.get('sell1')) : 0,
        sell2: showRanges ? num(fd.get('sell1')) * 1.1 : 0,
      };

      const baseFields = [record.ltp, record.qty, record.wacc];
      if (!record.script || baseFields.some((n) => !Number.isFinite(n)) || (showRanges && !Number.isFinite(record.sell1))) return;

      rows.push(record);
      const investedAmount = investedCost(record.wacc, record.qty);
      if (window.PmsCapital) window.PmsCapital.adjustCash(-investedAmount);
      persist();
      form.reset();
      form.querySelector('input[name="script"]').focus();
    }

    function readRows() {
      const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return raw.map((r) => ({
        id: r.id || crypto.randomUUID(),
        script: clean(r.script).toUpperCase(),
        ltp: num(r.ltp) || 0,
        qty: num(r.qty) || 0,
        wacc: num(r.wacc) || 0,
        sell1: num(r.sell1) || 0,
        sell2: num(r.sell2) || ((num(r.sell1) || 0) * 1.1),
      }));
    }

    function persist(message = 'Saved ✓') {
      localStorage.setItem(storageKey, JSON.stringify(rows));
      flashSaved(message);
      render();
    }

    function flashSaved(text = 'Saved ✓') {
      clearTimeout(indicatorTimer);
      indicator.textContent = text;
      indicatorTimer = setTimeout(() => {
        indicator.textContent = 'Saved ✓';
      }, 1800);
    }

    function render() {
      const keyword = clean(scriptFilter ? scriptFilter.value : '').toLowerCase();
      const list = [...rows]
        .filter((row) => !keyword || row.script.toLowerCase().includes(keyword))
        .sort(sorter);
      tableBody.innerHTML = '';

      list.forEach((row) => {
        const current = row.ltp * row.qty;
        const pl = (row.ltp - row.wacc) * row.qty;

        const tr = document.createElement('tr');
        tr.appendChild(editableCell(row, 'script', row.script, 'text', { transform: 'upper' }));
        tr.appendChild(editableCell(row, 'qty', row.qty, 'number'));
        tr.appendChild(ltpCell(row));
        if (showRanges) {
          tr.appendChild(rangeCell(row));
        }
        tr.appendChild(textCell(currency(current)));
        tr.appendChild(textCell(currency(pl), plClass(pl)));
        tr.appendChild(actionCell(row));
        tableBody.appendChild(tr);
      });

      updateSummary(list);
    }

    function editableCell(row, key, value, type, opts = {}) {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.className = 'inline-edit';
      input.value = value;
      input.type = type === 'number' ? 'number' : 'text';
      if (type === 'number') {
        input.min = '0';
        input.step = key === 'qty' ? '1' : '0.01';
      }

      input.addEventListener('blur', () => {
        const newValue = type === 'number'
          ? (key === 'qty' ? Math.floor(num(input.value)) : num(input.value))
          : clean(input.value);
        if (type === 'number' && !Number.isFinite(newValue)) return;
        row[key] = opts.transform === 'upper' ? String(newValue).toUpperCase() : newValue;
        persist();
      });

      td.appendChild(input);
      return td;
    }

    function ltpCell(row) {
      const td = document.createElement('td');
      const wrap = document.createElement('div');
      wrap.className = 'ltp-wrap';

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'inline-edit ltp-input';
      input.value = fmt(row.ltp);
      input.min = '0';
      input.step = '0.01';
      input.addEventListener('blur', () => {
        const value = num(input.value);
        if (!Number.isFinite(value)) return;
        row.ltp = value;
        persist();
      });

      wrap.append(input);
      td.appendChild(wrap);
      return td;
    }

    function rangeCell(row) {
      const td = document.createElement('td');
      const wrap = document.createElement('div');
      wrap.className = 'range-wrap';

      const low = document.createElement('input');
      low.type = 'number';
      low.className = 'inline-edit range-input';
      low.value = fmt2(row.sell1);
      low.step = '0.01';
      low.min = '0';

      const high = document.createElement('input');
      high.type = 'number';
      high.className = 'inline-edit range-input';
      high.value = fmt2(row.sell2 || (row.sell1 * 1.1));
      high.step = '0.01';
      high.min = '0';
      high.readOnly = true;

      low.addEventListener('blur', () => {
        const value = num(low.value);
        if (!Number.isFinite(value)) return;
        row.sell1 = value;
        row.sell2 = value * 1.1;
        high.value = fmt2(row.sell2);
        persist();
      });


      wrap.append(low, high);
      td.appendChild(wrap);
      return td;
    }

    function actionCell(row) {
      const td = document.createElement('td');
      td.className = 'actions-cell';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-secondary';
      editBtn.textContent = '✏️';
      editBtn.onclick = () => {
        openQuickEdit(row);
      };

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger';
      delBtn.textContent = '🗑️';
      delBtn.onclick = () => {
        openConfirmDialog({
          title: 'Delete Position',
          message: `Delete ${row.script}?`,
          confirmText: 'Delete',
          onConfirm: () => {
            const refund = investedCost(row.wacc, row.qty);
            if (window.PmsCapital) window.PmsCapital.adjustCash(refund);
            rows = rows.filter((r) => r.id !== row.id);
            persist('Deleted ✓');
          },
        });
      };

      const exitBtn = document.createElement('button');
      exitBtn.className = 'btn-secondary';
      exitBtn.textContent = '🧾';
      exitBtn.title = 'Exit to Past Trades';
      exitBtn.onclick = () => openExitDialog(row);

      td.append(editBtn, delBtn, exitBtn);
      return td;
    }

    function openMassEdit() {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal modal-fullscreen';
      const card = document.createElement('section');
      card.className = 'card modal-card mass-edit-modal';
      card.innerHTML = `
        <div class="toolbar mass-edit-head">
          <div>
            <h3>Mass Edit ${pageRoot.dataset.portfolioTitle || ''}</h3>
            <p class="subtitle">Quickly update Script, Qty, LTP, ${showRanges ? 'L.R/H.R, ' : ''}and WACC in one place.</p>
          </div>
          <button type="button" class="btn-danger" data-close="true">Close</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Script</th><th>Qty</th><th>LTP</th>${showRanges ? '<th>L.R / H.R</th>' : ''}<th>WACC</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="toolbar mass-edit-actions">
          <button type="button" class="btn-primary" data-save="true">Save Changes</button>
        </div>
      `;
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      const body = card.querySelector('tbody');
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input data-key="script" data-id="${row.id}" value="${row.script}" /></td>
          <td><input type="number" min="0" step="1" data-key="qty" data-id="${row.id}" value="${Math.floor(row.qty)}" /></td>
          <td><input type="number" min="0" step="0.01" data-key="ltp" data-id="${row.id}" value="${fmt2(row.ltp)}" /></td>
          ${showRanges ? `<td><input type="number" min="0" step="0.01" data-key="sell1" data-id="${row.id}" value="${fmt2(row.sell1)}" /></td>` : ''}
          <td><input type="number" min="0" step="0.01" data-key="wacc" data-id="${row.id}" value="${fmt2(row.wacc)}" /></td>
        `;
        body.appendChild(tr);
      });

      card.querySelector('[data-close="true"]').addEventListener('click', () => backdrop.remove());
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
      card.querySelector('[data-save="true"]').addEventListener('click', () => {
        const costBefore = rows.reduce((sum, row) => sum + investedCost(row.wacc, row.qty), 0);
        const drafts = [...card.querySelectorAll('input[data-id]')];
        drafts.forEach((input) => {
          const row = rows.find((r) => r.id === input.dataset.id);
          if (!row) return;
          const key = input.dataset.key;
          if (key === 'script') row.script = clean(input.value).toUpperCase();
          else if (key === 'qty') row.qty = Math.max(0, Math.floor(num(input.value) || 0));
          else if (key === 'ltp') row.ltp = Math.max(0, num(input.value) || 0);
          else if (key === 'wacc') row.wacc = Math.max(0, num(input.value) || 0);
          else if (key === 'sell1' && showRanges) {
            row.sell1 = Math.max(0, num(input.value) || 0);
            row.sell2 = row.sell1 * 1.1;
          }
        });
        const costAfter = rows.reduce((sum, row) => sum + investedCost(row.wacc, row.qty), 0);
        if (window.PmsCapital) window.PmsCapital.adjustCash(costBefore - costAfter);
        persist('Mass update saved ✓');
        backdrop.remove();
      });
    }

    function openQuickEdit(row) {
      const previousCost = investedCost(row.wacc, row.qty);
      const backdrop = buildModal({
        title: `Edit ${row.script}`,
        subtitle: 'Update quantity and WACC.',
        body: `
          <label>Quantity
            <input type="number" min="0" step="1" data-field="qty" value="${Math.floor(row.qty)}" />
          </label>
          <label>WACC
            <input type="number" min="0" step="0.01" data-field="wacc" value="${fmt2(row.wacc)}" />
          </label>
        `,
        actions: `<button class="btn-primary" type="button" data-confirm="true">Save</button>`,
      });
      const card = backdrop.querySelector('.modal-card');
      card.querySelector('[data-confirm="true"]').addEventListener('click', () => {
        const qty = Math.max(0, Math.floor(num(card.querySelector('[data-field="qty"]').value) || 0));
        const wacc = Math.max(0, num(card.querySelector('[data-field="wacc"]').value) || 0);
        row.qty = qty;
        row.wacc = wacc;
        const newCost = investedCost(row.wacc, row.qty);
        if (window.PmsCapital) window.PmsCapital.adjustCash(previousCost - newCost);
        persist();
        backdrop.remove();
      });
    }

    function openExitDialog(row) {
      const backdrop = buildModal({
        title: `Exit ${row.script}`,
        subtitle: 'Move this position to Past Trades.',
        body: `
          <label>Old Price
            <input type="number" min="0.01" step="0.01" data-field="soldPrice" required />
          </label>
          <label>Holding Days
            <input type="number" min="0" step="1" data-field="holdingDays" required />
          </label>
        `,
        actions: `<button class="btn-primary" type="button" data-confirm="true">Exit Selected</button>`,
      });
      const card = backdrop.querySelector('.modal-card');
      card.querySelector('[data-confirm="true"]').addEventListener('click', () => {
        const soldPrice = num(card.querySelector('[data-field="soldPrice"]').value);
        const holdingDays = Math.floor(num(card.querySelector('[data-field="holdingDays"]').value));
        if (!Number.isFinite(soldPrice) || soldPrice <= 0 || !Number.isFinite(holdingDays) || holdingDays < 0) return;
        exitToPastTrades(row, soldPrice, holdingDays);
        backdrop.remove();
      });
    }

    function exitToPastTrades(row, soldPrice, holdingDays) {
      const calc = tradeMath().calculateRoundTrip({
        buyPrice: row.wacc,
        soldPrice,
        qty: row.qty,
      });
      const exited = readJson('exitedTradesV2');
      exited.push({
        id: crypto.randomUUID(),
        type: storageKey === 'longterm' ? 'Long Term' : 'Trade',
        name: row.script || 'Trade',
        qty: row.qty,
        buyPrice: row.wacc,
        soldPrice,
        buyTotal: calc.invested,
        soldTotal: calc.realizedAmount,
        netSoldTotal: Number(calc.netRealizedAmount || calc.realizedAmount || 0),
        grossProfit: Number(calc.grossProfit || calc.profit || 0),
        capitalGainTax: Number(calc.capitalGainTax || 0),
        profit: Number(calc.netProfit || calc.profit || 0),
        perDayProfit: holdingDays > 0 ? Number(calc.netProfit || calc.profit || 0) / holdingDays : Number(calc.netProfit || calc.profit || 0),
        holdingDays,
      });
      localStorage.setItem('exitedTradesV2', JSON.stringify(exited));
      if (window.PmsCapital) window.PmsCapital.adjustCash(Number(calc.netRealizedAmount || calc.realizedAmount || 0));
      rows = rows.filter((r) => r.id !== row.id);
      persist('Exited ✓');
    }

    function openConfirmDialog({ title, message, confirmText, onConfirm }) {
      const backdrop = buildModal({
        title,
        subtitle: message,
        body: '',
        actions: `<button class="btn-danger" type="button" data-confirm="true">${confirmText}</button>`,
      });
      backdrop.querySelector('[data-confirm="true"]').addEventListener('click', () => {
        onConfirm();
        backdrop.remove();
      });
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

    function updateSummary(viewRows = rows) {
      const invested = viewRows.reduce((s, r) => s + r.wacc * r.qty, 0);
      const current = viewRows.reduce((s, r) => s + r.ltp * r.qty, 0);
      const pl = viewRows.reduce((s, r) => s + (r.ltp - r.wacc) * r.qty, 0);

      document.getElementById('totalInvested').textContent = currency(invested);
      document.getElementById('totalCurrent').textContent = currency(current);
      const plNode = document.getElementById('totalPL');
      plNode.textContent = currency(pl);
      plNode.className = plClass(pl);

      if (window.PmsAllocation) {
        window.PmsAllocation.renderAllocation('pageAllocationBreakdown', viewRows.map((row) => ({
          script: row.script,
          value: Number(row.ltp || 0) * Number(row.qty || 0),
        })));
      }
    }

    function sorter(a, b) {
      const val = (obj) => {
        switch (sortKey) {
          case 'script': return obj.script.toLowerCase();
          case 'ltp': return obj.ltp;
          case 'qty': return obj.qty;
          case 'sell1': return obj.sell1;
          case 'current': return obj.ltp * obj.qty;
          case 'pl': return (obj.ltp - obj.wacc) * obj.qty;
          default: return obj.script.toLowerCase();
        }
      };
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    }

    function plClass(value) {
      return value >= 0 ? 'value-profit' : 'value-loss';
    }

    function textCell(text, className = '') {
      const td = document.createElement('td');
      td.textContent = text;
      if (className) td.classList.add(className);
      return td;
    }

    function currency(value) {
      return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
    }

    function num(v) {
      return Number.parseFloat(v);
    }

    function fmt(v) {
      return Number.isFinite(v) ? String(v) : '0';
    }

    function fmt2(v) {
      return Number.isFinite(v) ? Number(v).toFixed(2) : '0.00';
    }

    function clean(v) {
      return String(v || '').trim();
    }

    function investedCost(price, qty) {
      return Number(price || 0) * Number(qty || 0);
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

    function readJson(key) {
      try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
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
