(function () {
  const SIP_STATE_KEY = 'sipStateV2';
  const LEGACY_SIP_KEY = 'sipData';
  const defaultSips = ['SSIS', 'KSLY'];

  const tabs = document.getElementById('sipTabs');
  const sipSelect = document.getElementById('sipSelect');
  const manualSipForm = document.getElementById('manualSipForm');
  const lumpSumForm = document.getElementById('lumpSumForm');
  const monthlyForm = document.getElementById('monthlyForm');
  const deleteSipBtn = document.getElementById('deleteSipBtn');
  const tbody = document.querySelector('#sipTable tbody');
  const pendingDues = document.getElementById('pendingDues');
  const msg = document.getElementById('sipMessage');

  if (!tabs || !manualSipForm) return;

  let state = readState();
  let activeSip = state.sips[0] || 'SSIS';
  syncLegacyData();
  bindEvents();
  render();

  function bindEvents() {
    monthlyForm.elements.dueMonth.value = monthValue(new Date());

    manualSipForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = clean(manualSipForm.elements.newSipName.value || '').toUpperCase();
      if (!name) return show('Enter a new SIP name.');
      if (state.sips.includes(name)) return show('SIP already exists.');
      state.sips.push(name);
      state.records[name] = state.records[name] || [];
      state.currentNav[name] = state.currentNav[name] || 0;
      activeSip = name;
      manualSipForm.reset();
      persist('SIP type added.');
    });

    deleteSipBtn.addEventListener('click', () => {
      const selected = sipSelect.value;
      if (defaultSips.includes(selected)) return show('Default SIP cannot be deleted.');
      state.sips = state.sips.filter((s) => s !== selected);
      delete state.records[selected];
      delete state.currentNav[selected];
      activeSip = state.sips[0] || 'SSIS';
      persist('SIP removed.');
    });

    lumpSumForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(lumpSumForm);
      const sipName = String(fd.get('sipName'));
      const amount = num(fd.get('amount'));
      const nav = num(fd.get('nav'));
      if (!Number.isFinite(amount) || !Number.isFinite(nav) || amount <= 0 || nav <= 0) return;

      addEntry(sipName, {
        id: crypto.randomUUID(),
        date: today(),
        type: 'LUMP_SUM',
        units: amount / nav,
        nav,
        amount,
      });
      lumpSumForm.reset();
      persist('Lump sum entry added.');
    });

    monthlyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(monthlyForm);
      const sipName = String(fd.get('sipName'));
      const units = num(fd.get('units'));
      const nav = num(fd.get('nav'));
      const dueMonth = String(fd.get('dueMonth'));
      if (!Number.isFinite(units) || !Number.isFinite(nav) || units <= 0 || nav <= 0 || !dueMonth) return;

      const entryDate = `${dueMonth}-15`;
      addEntry(sipName, {
        id: crypto.randomUUID(),
        date: entryDate,
        type: 'MONTHLY',
        units,
        nav,
        amount: units * nav,
      });
      monthlyForm.elements.dueMonth.value = monthValue(new Date());
      monthlyForm.elements.units.value = '';
      monthlyForm.elements.nav.value = '';
      persist('Monthly SIP entry added.');
    });

    [sipSelect, ...document.querySelectorAll('form select[name="sipName"]')].forEach((select) => {
      select.addEventListener('change', () => {
        activeSip = select.value;
        render();
      });
    });
  }

  function render() {
    tabs.innerHTML = '';
    state.sips.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn-secondary ${name === activeSip ? 'active' : ''}`;
      btn.textContent = name;
      btn.onclick = () => {
        activeSip = name;
        render();
      };
      tabs.appendChild(btn);
    });

    const selects = [sipSelect, ...document.querySelectorAll('form select[name="sipName"]')];
    selects.forEach((select) => {
      select.innerHTML = state.sips.map((name) => `<option value="${name}">${name}</option>`).join('');
      select.value = activeSip;
    });

    const nav = state.currentNav[activeSip] || latestNav(activeSip);
    const records = [...(state.records[activeSip] || [])].sort((a, b) => a.date.localeCompare(b.date));
    const totalUnits = records.reduce((sum, row) => sum + row.units, 0);

    document.getElementById('sipTotalUnits').textContent = fmtUnits(totalUnits);
    document.getElementById('sipCurrentNav').textContent = currency(nav);
    document.getElementById('sipTotalValue').textContent = currency(totalUnits * nav);

    tbody.innerHTML = '';
    records.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.date}</td><td>${row.type}</td><td>${fmtUnits(row.units)}</td><td>${fmtNav(row.nav)}</td><td>${currency(row.amount)}</td>`;
      tbody.appendChild(tr);
    });

    renderDues();
  }

  function renderDues() {
    pendingDues.innerHTML = '';
    state.sips.forEach((sip) => {
      dueMonthsUntilNow().forEach((dueDate) => {
        const hasEntry = (state.records[sip] || []).some((r) => r.type === 'MONTHLY' && r.date === dueDate);
        if (hasEntry) return;

        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-secondary';
        btn.textContent = 'Fill Due';
        btn.onclick = () => {
          activeSip = sip;
          monthlyForm.elements.sipName.value = sip;
          monthlyForm.elements.dueMonth.value = dueDate.slice(0, 7);
          render();
          show(`Due selected: ${sip} ${dueDate}`);
        };

        li.innerHTML = `<span>${sip}: Missing monthly entry for ${dueDate}</span><strong>Pending</strong>`;
        li.appendChild(btn);
        pendingDues.appendChild(li);
      });
    });

    if (!pendingDues.children.length) {
      pendingDues.innerHTML = '<li><span>No pending dues.</span><strong>✓</strong></li>';
    }
  }

  function dueMonthsUntilNow() {
    const list = [];
    const now = new Date();
    let y = 2026;
    let m = 2; // March (0-indexed)
    while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && m <= now.getUTCMonth())) {
      list.push(`${y}-${String(m + 1).padStart(2, '0')}-15`);
      m += 1;
      if (m > 11) {
        y += 1;
        m = 0;
      }
    }
    return list;
  }

  function addEntry(sipName, record) {
    state.records[sipName] = state.records[sipName] || [];
    const existingMonthly = state.records[sipName].find((item) => item.type === 'MONTHLY' && item.date === record.date);
    if (existingMonthly) {
      Object.assign(existingMonthly, record);
    } else {
      state.records[sipName].push(record);
    }
    state.currentNav[sipName] = record.nav;

    state.records[sipName] = state.records[sipName].map((item) => ({ ...item, nav: record.nav, amount: item.units * record.nav }));
    activeSip = sipName;
  }

  function latestNav(sipName) {
    const rows = state.records[sipName] || [];
    if (!rows.length) return 0;
    return rows[rows.length - 1].nav || 0;
  }

  function syncLegacyData() {
    if (Object.values(state.records).some((rows) => rows.length)) return;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_SIP_KEY) || '[]');
    if (!legacy.length) return;
    state.records.SSIS = legacy.map((row) => {
      const units = Number(row.units || (Number(row.amount || 0) / Number(row.nav || 1)));
      const nav = Number(row.nav || 0);
      return {
        id: row.id || crypto.randomUUID(),
        date: String(row.date || today()),
        type: 'LEGACY',
        units,
        nav,
        amount: units * nav,
      };
    }).filter((r) => Number.isFinite(r.units) && Number.isFinite(r.nav));
    state.currentNav.SSIS = latestNav('SSIS');
    persist('Legacy SIP data migrated to structured format.');
  }

  function readState() {
    const existing = JSON.parse(localStorage.getItem(SIP_STATE_KEY) || 'null');
    if (existing && Array.isArray(existing.sips)) return existing;
    return {
      sips: [...defaultSips],
      records: { SSIS: [], KSLY: [] },
      currentNav: {},
    };
  }

  function persist(message = 'Saved ✓') {
    localStorage.setItem(SIP_STATE_KEY, JSON.stringify(state));
    show(message);
    render();
  }

  function show(text) {
    msg.textContent = text;
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function num(value) {
    return Number.parseFloat(value);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthValue(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function fmtUnits(value) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value || 0);
  }

  function fmtNav(value) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value || 0);
  }

  function currency(value) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
  }
})();
