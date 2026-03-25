(function () {
  const SIP_STATE_KEY = 'sipStateV3';
  const LEGACY_KEYS = ['sipStateV2', 'sipData'];
  const defaultSips = ['SSIS', 'KSLY'];

  const tabs = document.getElementById('sipTabs');
  const manualSipForm = document.getElementById('manualSipForm');
  const lumpSumForm = document.getElementById('lumpSumForm');
  const navForm = document.getElementById('navForm');
  const deleteSipBtn = document.getElementById('deleteSipBtn');
  const historySipSelect = document.getElementById('historySipSelect');
  const tbody = document.querySelector('#sipTable tbody');
  const pendingDues = document.getElementById('pendingDues');
  const msg = document.getElementById('sipMessage');
  const currentNavItem = document.getElementById('sipCurrentNavItem');
  const downloadSipDataBtn = document.getElementById('downloadSipData');
  const restoreSipDataInput = document.getElementById('restoreSipData');

  const dueModal = document.getElementById('dueModal');
  const dueForm = document.getElementById('dueForm');
  const closeDueModalBtn = document.getElementById('closeDueModal');
  const dueModalTitle = document.getElementById('dueModalTitle');

  if (!tabs || !manualSipForm || !dueForm) return;

  let state = readState();
  let activeSip = state.activeSip && (state.activeSip === 'ALL_SIP' || state.sips.includes(state.activeSip))
    ? state.activeSip
    : 'ALL_SIP';
  let historySip = 'ALL';
  let dueContext = null;

  bindEvents();
  render();

  function bindEvents() {
    manualSipForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = clean(manualSipForm.elements.newSipName.value).toUpperCase();
      if (!name) return show('Enter a SIP name.');
      if (state.sips.includes(name)) return show('SIP already exists.');
      state.sips.push(name);
      state.records[name] = state.records[name] || [];
      state.currentNav[name] = state.currentNav[name] || 0;
      state.registeredAt[name] = today();
      activeSip = name;
      manualSipForm.reset();
      persist('Manual SIP added.');
    });

    deleteSipBtn.addEventListener('click', () => {
      if (!activeSip || activeSip === 'ALL_SIP') return show('Select a SIP to delete.');
      if (defaultSips.includes(activeSip)) return show('Default SIP cannot be deleted.');
      state.sips = state.sips.filter((s) => s !== activeSip);
      delete state.records[activeSip];
      delete state.currentNav[activeSip];
      delete state.registeredAt[activeSip];
      activeSip = 'ALL_SIP';
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
        units: Math.floor(amount / nav),
        nav,
      });
      lumpSumForm.reset();
      persist('Lump sum entry added.');
    });

    navForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(navForm);
      const sipName = String(fd.get('sipName'));
      const nav = num(fd.get('nav'));
      if (!Number.isFinite(nav) || nav <= 0) return;
      state.currentNav[sipName] = nav;
      persist('NAV updated.');
    });

    historySipSelect.addEventListener('change', () => {
      historySip = historySipSelect.value;
      renderHistory();
    });

    dueForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!dueContext) return;
      const fd = new FormData(dueForm);
      const units = Math.floor(num(fd.get('units')));
      const nav = num(fd.get('nav'));
      if (!Number.isFinite(units) || !Number.isFinite(nav) || units <= 0 || nav <= 0) {
        show('Invalid Units/NAV. Due not saved.');
        return;
      }

      addEntry(dueContext.sip, {
        id: crypto.randomUUID(),
        date: dueContext.dueDate,
        units,
        nav,
      });
      closeDueModal();
      persist(`Due resolved for ${dueContext.sip}.`);
    });

    closeDueModalBtn.addEventListener('click', closeDueModal);
    dueModal.addEventListener('click', (e) => {
      if (e.target === dueModal) closeDueModal();
    });

    downloadSipDataBtn.addEventListener('click', downloadSipData);
    restoreSipDataInput.addEventListener('change', restoreSipData);
  }

  function render() {
    tabs.innerHTML = '';

    const allBtn = tabButton('ALL_SIP', 'All SIP');
    tabs.appendChild(allBtn);
    state.sips.forEach((name) => tabs.appendChild(tabButton(name, name)));

    fillSipSelects();

    const sipNames = activeSip === 'ALL_SIP' ? state.sips : [activeSip];
    const totalUnits = sipNames.reduce((sum, sip) => sum + (state.records[sip] || []).reduce((s, row) => s + row.units, 0), 0);
    const totalValue = sipNames.reduce((sum, sip) => {
      const nav = state.currentNav[sip] || latestNav(sip);
      const units = (state.records[sip] || []).reduce((s, row) => s + row.units, 0);
      return sum + units * nav;
    }, 0);

    document.getElementById('sipTotalUnits').textContent = fmtUnits(totalUnits);
    document.getElementById('sipTotalValue').textContent = currency(totalValue);

    if (activeSip === 'ALL_SIP') {
      currentNavItem.classList.add('hidden');
      document.getElementById('sipCurrentNav').textContent = '—';
    } else {
      currentNavItem.classList.remove('hidden');
      document.getElementById('sipCurrentNav').textContent = currency(state.currentNav[activeSip] || latestNav(activeSip));
    }

    state.activeSip = activeSip;
    renderDues();
    renderHistory();
  }

  function tabButton(value, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-secondary ${value === activeSip ? 'active' : ''}`;
    btn.textContent = label;
    btn.onclick = () => {
      activeSip = value;
      persist('Saved ✓');
    };
    return btn;
  }

  function fillSipSelects() {
    const selects = [...document.querySelectorAll('form select[name="sipName"]')];
    selects.forEach((select) => {
      select.innerHTML = state.sips.map((name) => `<option value="${name}">${name}</option>`).join('');
      select.value = activeSip === 'ALL_SIP' ? (state.sips[0] || '') : activeSip;
      select.onchange = () => {
        activeSip = select.value;
        render();
      };
    });

    historySipSelect.innerHTML = ['<option value="ALL">All SIPs</option>']
      .concat(state.sips.map((name) => `<option value="${name}">${name}</option>`))
      .join('');
    historySipSelect.value = historySip;
  }

  function renderHistory() {
    const rows = [];
    const sipNames = historySip === 'ALL' ? state.sips : [historySip];

    sipNames.forEach((sipName) => {
      (state.records[sipName] || []).forEach((row) => rows.push({ ...row, sipName }));
    });

    rows.sort((a, b) => a.date.localeCompare(b.date));
    tbody.innerHTML = '';

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.sipName}</td>
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
      tr.innerHTML = '<td colspan="6">No SIP history found for this selection.</td>';
      tbody.appendChild(tr);
    }
  }

  function renderDues() {
    pendingDues.innerHTML = '';

    state.sips.forEach((sip) => {
      dueMonthsUntilNow(sip).forEach((dueDate) => {
        const hasEntry = (state.records[sip] || []).some((r) => r.date === dueDate);
        if (hasEntry) return;

        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-secondary';
        btn.textContent = 'Fill Due';
        btn.onclick = () => openDueModal(sip, dueDate);

        li.innerHTML = `<span>${sip}: Missing entry for ${dueDate}</span><strong>Pending</strong>`;
        li.appendChild(btn);
        pendingDues.appendChild(li);
      });
    });

    if (!pendingDues.children.length) {
      pendingDues.innerHTML = '<li><span>No pending dues.</span><strong>✓</strong></li>';
    }
  }

  function openDueModal(sip, dueDate) {
    dueContext = { sip, dueDate };
    dueModalTitle.textContent = `${sip} due of ${dueDate}`;
    dueForm.reset();
    dueModal.classList.remove('hidden');
  }

  function closeDueModal() {
    dueContext = null;
    dueModal.classList.add('hidden');
  }

  function dueMonthsUntilNow(sipName) {
    const list = [];
    const start = new Date(state.registeredAt[sipName] || today());
    const now = new Date();
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();

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
    const sanitized = {
      id: record.id,
      date: String(record.date),
      units: Math.floor(Number(record.units || 0)),
      nav: Number(record.nav || 0),
    };
    sanitized.amount = sanitized.units * sanitized.nav;

    state.records[sipName] = (state.records[sipName] || []).filter((item) => item.date !== sanitized.date);
    state.records[sipName].push(sanitized);
    state.currentNav[sipName] = sanitized.nav;
    activeSip = sipName;
  }

  function latestNav(sipName) {
    const rows = state.records[sipName] || [];
    if (!rows.length) return 0;
    return rows[rows.length - 1].nav || 0;
  }

  function readState() {
    const existing = JSON.parse(localStorage.getItem(SIP_STATE_KEY) || 'null');
    if (existing && Array.isArray(existing.sips)) return normalizeState(existing);

    for (const key of LEGACY_KEYS) {
      const legacy = JSON.parse(localStorage.getItem(key) || 'null');
      if (!legacy) continue;
      if (key === 'sipStateV2' && Array.isArray(legacy.sips)) {
        return normalizeState(legacy);
      }

      if (key === 'sipData' && Array.isArray(legacy)) {
        return normalizeState({
          sips: [...defaultSips],
          records: { SSIS: legacy, KSLY: [] },
          currentNav: {},
        });
      }
    }

    return normalizeState({ sips: [...defaultSips], records: { SSIS: [], KSLY: [] }, currentNav: {} });
  }

  function normalizeState(input) {
    const sips = Array.from(new Set([...(input.sips || []), ...defaultSips]));
    const records = {};
    const currentNav = { ...(input.currentNav || {}) };
    const registeredAt = { ...(input.registeredAt || {}) };

    sips.forEach((sip) => {
      records[sip] = Array.isArray((input.records || {})[sip])
        ? input.records[sip].map((r) => ({
          id: r.id || crypto.randomUUID(),
          date: String(r.date || today()),
          units: Math.floor(Number(r.units || (Number(r.amount || 0) / Number(r.nav || 1)))),
          nav: Number(r.nav || 0),
          amount: Math.floor(Number(r.units || (Number(r.amount || 0) / Number(r.nav || 1)))) * Number(r.nav || 0),
        }))
        : [];
      if (!registeredAt[sip]) {
        const firstDate = records[sip][0]?.date || today();
        registeredAt[sip] = firstDate;
      }
      if (!Number.isFinite(currentNav[sip])) {
        currentNav[sip] = records[sip].length ? records[sip][records[sip].length - 1].nav : 0;
      }
    });

    return {
      sips,
      records,
      currentNav,
      registeredAt,
      activeSip: input.activeSip || 'ALL_SIP',
    };
  }

  function persist(message = 'Saved ✓') {
    localStorage.setItem(SIP_STATE_KEY, JSON.stringify(state));
    show(message);
    render();
  }

  function downloadSipData() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sip-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    show('SIP backup downloaded.');
  }

  function restoreSipData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        state = normalizeState(parsed);
        activeSip = state.activeSip || 'ALL_SIP';
        historySip = 'ALL';
        persist('SIP backup restored.');
      } catch (err) {
        show('Invalid backup file.');
      }
    };
    reader.readAsText(file);
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

  function fmtUnits(value) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.floor(value || 0));
  }

  function fmtNav(value) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  }

  function currency(value) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
  }
})();
