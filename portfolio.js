(function () {
  const pageRoot = document.querySelector('[data-portfolio-key]');
  if (!pageRoot) return;

  const storageKey = pageRoot.dataset.portfolioKey;
  const tableBody = document.querySelector('#portfolioTable tbody');
  const form = document.getElementById('addForm');
  const indicator = document.getElementById('saveIndicator');
  let sortKey = 'script';
  let sortDir = 1;
  let rows = readRows();
  let undoState = null;
  let indicatorTimer;

  bindEvents();
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

    form.querySelectorAll('[data-next]').forEach((el, idx, all) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (all[idx + 1] || form.querySelector('button[type="submit"]')).focus();
        }
      });
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(form);
    const record = {
      id: crypto.randomUUID(),
      script: clean(fd.get('script')),
      sector: clean(fd.get('sector')),
      ltp: num(fd.get('ltp')),
      qty: num(fd.get('qty')),
      wacc: num(fd.get('wacc')),
      sell1: num(fd.get('sell1')),
    };
    if (!record.script || !record.sector || [record.ltp, record.qty, record.wacc, record.sell1].some((n) => Number.isNaN(n))) {
      return;
    }
    rows.push(record);
    persist();
    form.reset();
    form.querySelector('input[name="script"]').focus();
  }

  function readRows() {
    const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return raw.map((r) => ({
      id: r.id || crypto.randomUUID(),
      script: clean(r.script),
      sector: clean(r.sector),
      ltp: num(r.ltp),
      qty: num(r.qty),
      wacc: num(r.wacc),
      sell1: num(r.sell1),
    }));
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(rows));
    flashSaved();
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
      const sell2 = row.sell1 * 1.1;
      const distance = row.ltp - row.sell1;
      const current = row.ltp * row.qty;
      const pl = (row.ltp - row.wacc) * row.qty;

      const tr = document.createElement('tr');
      tr.className = row.ltp >= row.sell1 ? 'highlight-row' : '';

      tr.appendChild(editableCell(row, 'script', row.script, 'text'));
      tr.appendChild(editableCell(row, 'sector', row.sector, 'text'));
      tr.appendChild(editableCell(row, 'ltp', fmt(row.ltp), 'number'));
      tr.appendChild(sellCell(row, sell2));
      tr.appendChild(textCell(currency(distance), plClass(distance)));
      tr.appendChild(textCell(currency(current)));
      tr.appendChild(textCell(currency(pl), plClass(pl)));
      tr.appendChild(actionCell(row));

      tableBody.appendChild(tr);
    });

    updateSummary();
  }

  function editableCell(row, key, value, type) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.className = 'inline-edit';
    input.value = value;
    input.type = type === 'number' ? 'number' : 'text';
    if (type === 'number') {
      input.min = '0';
      input.step = '0.01';
    }
    input.addEventListener('input', () => {
      row[key] = type === 'number' ? num(input.value) : clean(input.value);
      persist();
    });
    td.appendChild(input);
    return td;
  }

  function sellCell(row, sell2) {
    const td = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '6px';

    const sell1 = document.createElement('input');
    sell1.type = 'number';
    sell1.className = 'inline-edit';
    sell1.value = fmt(row.sell1);
    sell1.min = '0';
    sell1.step = '0.01';

    const sell2Input = document.createElement('input');
    sell2Input.type = 'text';
    sell2Input.value = fmt(sell2);
    sell2Input.disabled = true;

    sell1.addEventListener('input', () => {
      row.sell1 = num(sell1.value);
      persist();
    });

    wrap.append(sell1, sell2Input);
    td.appendChild(wrap);
    return td;
  }

  function actionCell(row) {
    const td = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-secondary';
    editBtn.textContent = 'Edit Hidden';
    editBtn.onclick = () => {
      const qty = prompt('Quantity', String(row.qty));
      if (qty === null) return;
      const wacc = prompt('WACC (hidden field)', String(row.wacc));
      if (wacc === null) return;
      row.qty = num(qty);
      row.wacc = num(wacc);
      persist();
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => {
      if (!confirm('Delete this row?')) return;
      undoState = { row: { ...row }, index: rows.findIndex((r) => r.id === row.id) };
      rows = rows.filter((r) => r.id !== row.id);
      persist();
      indicator.textContent = 'Deleted. Undo available';
      const undoBtn = document.createElement('button');
      undoBtn.className = 'btn-secondary';
      undoBtn.textContent = 'Undo';
      undoBtn.onclick = () => {
        if (!undoState) return;
        rows.splice(undoState.index, 0, undoState.row);
        undoState = null;
        persist();
      };
      indicator.replaceChildren(undoBtn);
      indicatorTimer = setTimeout(() => {
        undoState = null;
        indicator.textContent = 'Saved ✓';
      }, 5000);
    };

    td.append(editBtn, delBtn);
    td.style.display = 'flex';
    td.style.gap = '6px';
    return td;
  }

  function textCell(text, className = '') {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.classList.add(className);
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
        case 'sell1': return obj.sell1;
        case 'distance': return obj.ltp - obj.sell1;
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

  function currency(value) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
  }

  function num(v) {
    return Number.parseFloat(v);
  }

  function fmt(v) {
    return Number.isFinite(v) ? String(v) : '0';
  }

  function clean(v) {
    return String(v || '').trim();
  }
})();
