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
        sector: clean(fd.get('sector')),
        ltp: num(fd.get('ltp')),
        qty: num(fd.get('qty')),
        wacc: num(fd.get('wacc')),
        sell1: showRanges ? num(fd.get('sell1')) : 0,
        sell2: showRanges ? num(fd.get('sell1')) * 1.1 : 0,
      };

      const baseFields = [record.ltp, record.qty, record.wacc];
      if (!record.script || !record.sector || baseFields.some((n) => !Number.isFinite(n)) || (showRanges && !Number.isFinite(record.sell1))) return;

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
        sector: clean(r.sector),
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
      const list = [...rows].sort(sorter);
      tableBody.innerHTML = '';

      list.forEach((row) => {
        const current = row.ltp * row.qty;
        const pl = (row.ltp - row.wacc) * row.qty;

        const tr = document.createElement('tr');
        tr.appendChild(editableCell(row, 'script', row.script, 'text', { transform: 'upper' }));
        tr.appendChild(editableCell(row, 'sector', row.sector, 'text'));
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

      updateSummary();
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
        const previousCost = investedCost(row.wacc, row.qty);
        const qty = prompt('Quantity', String(row.qty));
        if (qty === null) return;
        const wacc = prompt('WACC', String(row.wacc));
        if (wacc === null) return;
        row.qty = num(qty) || row.qty;
        row.wacc = num(wacc) || row.wacc;
        const newCost = investedCost(row.wacc, row.qty);
        if (window.PmsCapital) window.PmsCapital.adjustCash(previousCost - newCost);
        persist();
      };

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger';
      delBtn.textContent = '🗑️';
      delBtn.onclick = () => {
        if (!confirm('Delete this row?')) return;
        const refund = investedCost(row.wacc, row.qty);
        if (window.PmsCapital) window.PmsCapital.adjustCash(refund);
        rows = rows.filter((r) => r.id !== row.id);
        persist('Deleted ✓');
      };

      td.append(editBtn, delBtn);
      return td;
    }

    function updateSummary() {
      const invested = rows.reduce((s, r) => s + r.wacc * r.qty, 0);
      const current = rows.reduce((s, r) => s + r.ltp * r.qty, 0);
      const pl = rows.reduce((s, r) => s + (r.ltp - r.wacc) * r.qty, 0);

      document.getElementById('totalInvested').textContent = currency(invested);
      document.getElementById('totalCurrent').textContent = currency(current);
      const plNode = document.getElementById('totalPL');
      plNode.textContent = currency(pl);
      plNode.className = plClass(pl);
    }

    function sorter(a, b) {
      const val = (obj) => {
        switch (sortKey) {
          case 'script': return obj.script.toLowerCase();
          case 'sector': return obj.sector.toLowerCase();
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
      return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
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
      const calc = window.PmsTradeMath
        ? window.PmsTradeMath.calculateTransaction('buy', Number(price || 0), Number(qty || 0))
        : null;
      if (calc && Number.isFinite(calc.totalPayable)) return calc.totalPayable;
      return Number(price || 0) * Number(qty || 0);
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
