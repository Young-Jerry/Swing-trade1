import { pushData, subscribeData, updateData, deleteData, saveData } from './firebase-db.js';

const pageRoot = document.querySelector('[data-portfolio-key]');
if (pageRoot) {
  const storageKey = pageRoot.dataset.portfolioKey;
  const showRanges = pageRoot.dataset.showRanges === 'true';
  const tableBody = document.querySelector('#portfolioTable tbody');
  const form = document.getElementById('addForm');
  const indicator = document.getElementById('saveIndicator');
  const dbPath = storageKey === 'longterm' ? 'longterm' : 'trades';

  let sortKey = 'script';
  let sortDir = 1;
  let rows = [];
  let indicatorTimer;

  bindEvents();
  subscribeData(dbPath, (data) => {
    rows = Object.entries(data || {}).map(([id, r]) => ({
      id,
      script: clean(r.script).toUpperCase(),
      sector: clean(r.sector),
      ltp: num(r.ltp) || 0,
      qty: num(r.qty) || 0,
      wacc: num(r.wacc) || 0,
      sell1: num(r.sell1) || 0,
      sell2: num(r.sell2) || ((num(r.sell1) || 0) * 1.1),
    }));
    render();
  });

  function bindEvents() {
    form.addEventListener('submit', onSubmit);
    document.querySelectorAll('th[data-sort]').forEach((th) => {
      if (th.dataset.sort === 'actions') return;
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) sortDir *= -1;
        else { sortKey = key; sortDir = 1; }
        render();
      });
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(form);
    const record = {
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
    await pushData(dbPath, record);
    form.reset();
    form.querySelector('input[name="script"]').focus();
    flashSaved('Saved ✓');
  }

  async function patchRow(row, patch, message = 'Saved ✓') {
    await updateData(`${dbPath}/${row.id}`, patch);
    flashSaved(message);
  }

  function flashSaved(text = 'Saved ✓') {
    clearTimeout(indicatorTimer);
    indicator.textContent = text;
    indicatorTimer = setTimeout(() => { indicator.textContent = 'Saved ✓'; }, 1800);
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
      tr.appendChild(ltpCell(row));
      if (showRanges) tr.appendChild(rangeCell(row));
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
    if (type === 'number') { input.min = '0'; input.step = '0.01'; }

    input.addEventListener('blur', () => {
      const newValue = type === 'number' ? num(input.value) : clean(input.value);
      if (type === 'number' && !Number.isFinite(newValue)) return;
      patchRow(row, { [key]: opts.transform === 'upper' ? String(newValue).toUpperCase() : newValue });
    });

    td.appendChild(input);
    return td;
  }

  function ltpCell(row) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'inline-edit ltp-input';
    input.value = fmt(row.ltp);
    input.min = '0';
    input.step = '0.01';
    input.addEventListener('blur', () => {
      const value = num(input.value);
      if (!Number.isFinite(value)) return;
      patchRow(row, { ltp: value });
    });
    td.appendChild(input);
    return td;
  }

  function rangeCell(row) {
    const td = document.createElement('td');
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
      patchRow(row, { sell1: value, sell2: value * 1.1 });
      high.value = fmt2(value * 1.1);
    });

    td.append(low, high);
    return td;
  }

  function actionCell(row) {
    const td = document.createElement('td');
    td.className = 'actions-cell';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-secondary';
    editBtn.textContent = 'Edit Qty/WACC';
    editBtn.onclick = async () => {
      const qty = prompt('Quantity', String(row.qty));
      if (qty === null) return;
      const wacc = prompt('WACC', String(row.wacc));
      if (wacc === null) return;
      await patchRow(row, { qty: num(qty) || row.qty, wacc: num(wacc) || row.wacc });
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      if (!confirm('Delete this row?')) return;
      await deleteData(`${dbPath}/${row.id}`);
      flashSaved('Deleted ✓');
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
    saveData(`portfolio/${dbPath}/summary`, { invested, current, pl, updatedAt: new Date().toISOString() });
  }

  function sorter(a, b) {
    const val = (obj) => ({ script: obj.script.toLowerCase(), sector: obj.sector.toLowerCase(), ltp: obj.ltp, sell1: obj.sell1, current: obj.ltp * obj.qty, pl: (obj.ltp - obj.wacc) * obj.qty }[sortKey] ?? obj.script.toLowerCase());
    const av = val(a);
    const bv = val(b);
    if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  }

  function plClass(value) { return value >= 0 ? 'value-profit' : 'value-loss'; }
  function textCell(text, className = '') { const td = document.createElement('td'); td.textContent = text; if (className) td.classList.add(className); return td; }
  function currency(value) { return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`; }
  function num(v) { return Number.parseFloat(v); }
  function fmt(v) { return Number.isFinite(v) ? String(v) : '0'; }
  function fmt2(v) { return Number.isFinite(v) ? Number(v).toFixed(2) : '0.00'; }
  function clean(v) { return String(v || '').trim(); }
}
