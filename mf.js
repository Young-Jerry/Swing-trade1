(function () {
  const SIP_STATE_KEY = 'sipStateV4';
  const LEGACY_KEYS = ['sipStateV3', 'sipStateV2', 'sipData'];
  const defaultSips = ['SSIS', 'KSLY'];
  const forcedStartMonth = {
    SSIS: '2025-07',
    KSLY: '2026-02',
  };

  const tabs = document.getElementById('sipTabs');
  const manualSipForm = document.getElementById('manualSipForm');
  const installmentForm = document.getElementById('installmentForm');
  const navForm = document.getElementById('navForm');
  const deleteSipBtn = document.getElementById('deleteSipBtn');
  const historySipSelect = document.getElementById('historySipSelect');
  const tbody = document.querySelector('#sipTable tbody');
  const msg = document.getElementById('sipMessage');
  const currentNavItem = document.getElementById('sipCurrentNavItem');

  if (!tabs || !manualSipForm || !installmentForm || !navForm) return;

  let state = readState();
  let activeSip = state.activeSip && (state.activeSip === 'ALL_SIP' || state.sips.includes(state.activeSip))
    ? state.activeSip
    : 'ALL_SIP';
  let historySip = 'ALL';

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
      state.registeredAt[name] = month15(todayMonth());
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

    installmentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(installmentForm);
      const sipName = String(fd.get('sipName'));
      const month = String(fd.get('month'));
      const units = Math.floor(num(fd.get('units')));
      const nav = num(fd.get('nav'));
      if (!sipName || !isValidMonth(month)) return show('Select a valid month.');
      if (!Number.isFinite(units) || !Number.isFinite(nav) || units <= 0 || nav <= 0) return show('Invalid QTY/NAV.');
      if (!isMonthAllowed(sipName, month)) return show(`Month must be on/after ${minimumMonthForSip(sipName)}.`);

      addOrMergeEntry(sipName, {
        id: crypto.randomUUID(),
        date: month15(month),
        units,
        nav,
      });

      installmentForm.reset();
      persist('Installment added.');
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

    installmentForm.elements.sipName.addEventListener('change', syncInstallmentMinMonth);
    installmentForm.elements.month.addEventListener('change', syncInstallmentDateDisplay);
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

    syncInstallmentMinMonth();
    syncInstallmentDateDisplay();
  }

  function renderHistory() {
    const rows = historyRows();

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

  function historyRows() {
    const sipNames = historySip === 'ALL' ? state.sips : [historySip];
    const merged = new Map();

    sipNames.forEach((sipName) => {
      (state.records[sipName] || []).forEach((row) => {
        const key = `${sipName}__${row.date}`;
        const prev = merged.get(key) || {
          id: row.id,
          date: row.date,
          sipName,
          units: 0,
          amount: 0,
        };
        prev.units += Number(row.units || 0);
        prev.amount += Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0)));
        merged.set(key, prev);
      });
    });

    return Array.from(merged.values())
      .map((r) => ({
        ...r,
        nav: r.units > 0 ? r.amount / r.units : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.sipName.localeCompare(b.sipName));
  }

  function syncInstallmentMinMonth() {
    const sip = installmentForm.elements.sipName.value;
    const monthInput = installmentForm.elements.month;
    const minMonth = minimumMonthForSip(sip);
    monthInput.min = minMonth;
    if (!monthInput.value || monthInput.value < minMonth) {
      monthInput.value = minMonth;
    }
    syncInstallmentDateDisplay();
  }

  function syncInstallmentDateDisplay() {
    const month = installmentForm.elements.month.value || minimumMonthForSip(installmentForm.elements.sipName.value);
    installmentForm.elements.date.value = `${month}-15`;
  }

  function minimumMonthForSip(sipName) {
    if (forcedStartMonth[sipName]) return forcedStartMonth[sipName];
    const reg = String(state.registeredAt[sipName] || today()).slice(0, 7);
    return isValidMonth(reg) ? reg : todayMonth();
  }

  function isMonthAllowed(sipName, month) {
    const minMonth = minimumMonthForSip(sipName);
    return month >= minMonth;
  }

  function isValidMonth(value) {
    return /^\d{4}-\d{2}$/.test(value);
  }

  function month15(month) {
    return `${month}-15`;
  }

  function addOrMergeEntry(sipName, record) {
    state.records[sipName] = state.records[sipName] || [];
    const sanitized = {
      id: record.id,
      date: String(record.date),
      units: Math.floor(Number(record.units || 0)),
      nav: Number(record.nav || 0),
    };
    sanitized.amount = sanitized.units * sanitized.nav;

    const existing = state.records[sipName].find((item) => item.date === sanitized.date);
    if (existing) {
      const mergedUnits = Number(existing.units || 0) + sanitized.units;
      const mergedAmount = Number(existing.amount || (existing.units * existing.nav)) + sanitized.amount;
      existing.units = mergedUnits;
      existing.amount = mergedAmount;
      existing.nav = mergedUnits > 0 ? mergedAmount / mergedUnits : sanitized.nav;
    } else {
      state.records[sipName].push(sanitized);
    }

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
      if ((key === 'sipStateV3' || key === 'sipStateV2') && Array.isArray(legacy.sips)) {
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
          date: String(r.date || month15(todayMonth())),
          units: Math.floor(Number(r.units || (Number(r.amount || 0) / Number(r.nav || 1)))),
          nav: Number(r.nav || 0),
          amount: Math.floor(Number(r.units || (Number(r.amount || 0) / Number(r.nav || 1)))) * Number(r.nav || 0),
        }))
        : [];
      records[sip].sort((a, b) => a.date.localeCompare(b.date));

      if (!registeredAt[sip]) {
        const firstDate = records[sip][0]?.date || month15(todayMonth());
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

  function show(text) {
    msg.textContent = text;
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function num(value) {
    return Number.parseFloat(value);
  }

  function todayMonth() {
    return new Date().toISOString().slice(0, 7);
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
