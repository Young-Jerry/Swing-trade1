(function () {
  const SIP_STATE_KEY = 'sipStateV2';
  const LEGACY_SIP_KEY = 'sipData';
  const defaultSips = ['SSIS', 'KSLY'];

  const tabs = document.getElementById('sipTabs');
  const manualSipForm = document.getElementById('manualSipForm');
  const lumpSumForm = document.getElementById('lumpSumForm');
  const monthlyForm = document.getElementById('monthlyForm');
  const navForm = document.getElementById('navForm');
  const deleteSipBtn = document.getElementById('deleteSipBtn');
  const historySipSelect = document.getElementById('historySipSelect');
  const tbody = document.querySelector('#sipTable tbody');
  const pendingDues = document.getElementById('pendingDues');
  const msg = document.getElementById('sipMessage');

  if (!tabs || !manualSipForm) return;

  let state = readState();
  let activeSip = state.sips[0] || 'SSIS';
  let historySip = 'ALL';

  syncLegacyData();
  bindEvents();
  render();

  function bindEvents() {
    monthlyForm.elements.dueMonth.value = monthValue(new Date());

    manualSipForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = clean(manualSipForm.elements.newSipName.value).toUpperCase();
      if (!name) return show('Enter a SIP name.');
      if (state.sips.includes(name)) return show('SIP already exists.');
      state.sips.push(name);
      state.records[name] = state.records[name] || [];
      state.currentNav[name] = state.currentNav[name] || 0;
      activeSip = name;
      manualSipForm.reset();
      persist('Manual SIP added.');
    });

    deleteSipBtn.addEventListener('click', () => {
      if (!activeSip || defaultSips.includes(activeSip)) return show('Default SIP cannot be deleted.');
      state.sips = state.sips.filter((s) => s !== activeSip);
      delete state.records[activeSip];
      delete state.currentNav[activeSip];
      activeSip = state.sips[0] || 'SSIS';
      historySip = 'ALL';
      persist('SIP deleted.');
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
        units: Math.floor(amount / nav),
        nav,
      });
      lumpSumForm.reset();
      persist('Lump sum entry added.');
    });

    monthlyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(monthlyForm);
      const sipName = String(fd.get('sipName'));
      const units = Math.floor(num(fd.get('units')));
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
      });
      monthlyForm.elements.dueMonth.value = monthValue(new Date());
      monthlyForm.elements.units.value = '';
      monthlyForm.elements.nav.value = '';
      persist('Monthly SIP entry added.');
    });

    navForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(navForm);
      const sipName = String(fd.get('sipName'));
      const nav = num(fd.get('nav'));
      if (!Number.isFinite(nav) || nav <= 0) return;
      state.currentNav[sipName] = nav;
      (state.records[sipName] || []).forEach((item) => {
        item.nav = nav;
        item.amount = item.units * nav;
      });
      persist('NAV updated.');
    });

    historySipSelect.addEventListener('change', () => {
      historySip = historySipSelect.value;
      renderHistory();
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

    fillSipSelects();

    const records = state.records[activeSip] || [];
    const nav = state.currentNav[activeSip] || latestNav(activeSip);
    const totalUnits = records.reduce((sum, row) => sum + row.units, 0);
    document.getElementById('sipTotalUnits').textContent = fmtUnits(totalUnits);
    document.getElementById('sipCurrentNav').textContent = currency(nav);
    document.getElementById('sipTotalValue').textContent = currency(totalUnits * nav);

    renderDues();
    renderHistory();
  }

  function fillSipSelects() {
    const selects = [
      ...document.querySelectorAll('form select[name="sipName"]'),
    ];
    selects.forEach((select) => {
      select.innerHTML = state.sips.map((name) => `<option value="${name}">${name}</option>`).join('');
      select.value = activeSip;
      select.onchange = () => {
        activeSip = select.value;
        render();
      };
    });

    historySipSelect.innerHTML = ['<option value="ALL">All SIPs (Summary)</option>']
      .concat(state.sips.map((name) => `<option value="${name}">${name}</option>`))
      .join('');
    historySipSelect.value = historySip;
  }

  function renderHistory() {
    const rows = [];
    const sipNames = historySip === 'ALL' ? state.sips : [historySip];

    sipNames.forEach((sipName) => {
      (state.records[sipName] || []).forEach((row) => {
        rows.push({ ...row, sipName });
      });
    });

    rows.sort((a, b) => a.date.localeCompare(b.date));
    tbody.innerHTML = '';

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.sipName}</td>
        <td>${row.type}</td>
        <td>${fmtUnits(row.units)}</td>
        <td>${fmtNav(row.nav)}</td>
        <td>${currency(row.amount)}</td>
        <td><button class="btn-danger" data-action="deleteRow" data-sip="${row.sipName}" data-id="${row.id}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-action="deleteRow"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sip = btn.dataset.sip;
        const id = btn.dataset.id;
        state.records[sip] = (state.records[sip] || []).filter((row) => row.id !== id);
        persist('SIP history row deleted.');
      });
    });

    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7">No SIP history found for this selection.</td>';
      tbody.appendChild(tr);
    }
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
        btn.onclick = () => resolveDuePopup(sip, dueDate);

        li.innerHTML = `<span>${sip}: Missing monthly entry for ${dueDate}</span><strong>Pending</strong>`;
        li.appendChild(btn);
        pendingDues.appendChild(li);
      });
    });

    if (!pendingDues.children.length) {
      pendingDues.innerHTML = '<li><span>No pending dues.</span><strong>✓</strong></li>';
    }
  }

  function resolveDuePopup(sip, dueDate) {
    const unitsInput = prompt(`${sip} due ${dueDate} - Units (whole number):`);
    if (unitsInput === null) return;
    const navInput = prompt(`${sip} due ${dueDate} - NAV:`);
    if (navInput === null) return;

    const units = Math.floor(num(unitsInput));
    const nav = num(navInput);
    if (!Number.isFinite(units) || !Number.isFinite(nav) || units <= 0 || nav <= 0) {
      show('Invalid Units/NAV. Due not saved.');
      return;
    }

    addEntry(sip, {
      id: crypto.randomUUID(),
      date: dueDate,
      type: 'MONTHLY_DUE',
      units,
      nav,
    });
    persist(`Due resolved for ${sip}.`);
  }

  function dueMonthsUntilNow() {
    const list = [];
    const now = new Date();
    let y = 2026;
    let m = 2;
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
    state.records[sipName] = state.records[sipName].filter((item) => !(item.type.startsWith('MONTHLY') && item.date === record.date));

    const sanitized = {
      ...record,
      units: Math.floor(Number(record.units || 0)),
      amount: Math.floor(Number(record.units || 0)) * Number(record.nav || 0),
    };
    state.records[sipName].push(sanitized);
    state.currentNav[sipName] = sanitized.nav;
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
      const units = Math.floor(Number(row.units || (Number(row.amount || 0) / Number(row.nav || 1))));
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
    persist('Legacy SIP data migrated.');
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
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.floor(value || 0));
  }

  function fmtNav(value) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value || 0);
  }

  function currency(value) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
  }
})();
