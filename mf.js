(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;
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
    const tableHead = document.getElementById('sipTableHead');
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
        const refundAmount = (state.records[activeSip] || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
        if (window.PmsCapital && refundAmount) window.PmsCapital.adjustCash(refundAmount);
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
        const date = String(fd.get('date'));
        const month = monthFromDate(date);
        const units = Math.floor(num(fd.get('units')));
        const nav = num(fd.get('nav'));
        if (!sipName || !isValidDate(date)) return show('Select a valid date.');
        if (!Number.isFinite(units) || !Number.isFinite(nav) || units <= 0 || nav <= 0) return show('Invalid QTY/NAV.');
        if (!isMonthAllowed(sipName, month)) return show(`Month must be on/after ${minimumMonthForSip(sipName)}.`);
        if (monthExists(sipName, month)) return show('This month is already paid and locked for the selected SIP.');

        addEntry(sipName, {
          id: crypto.randomUUID(),
          date,
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

      installmentForm.elements.sipName.addEventListener('change', syncInstallmentDateDisplay);
      installmentForm.elements.date.addEventListener('change', syncInstallmentDateDisplay);
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

      syncInstallmentDateDisplay();
    }

    function renderHistory() {
      const rows = historyRows();

      tbody.innerHTML = '';
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          ${historySip === 'ALL' ? '' : `<td>${row.date}</td>`}
          <td>${row.sipName}</td>
          <td>${fmtUnits(row.units)}</td>
          <td>${fmtNav(row.nav)}</td>
          <td>${currency(row.amount)}</td>
          ${historySip === 'ALL' ? '' : `<td class="actions-cell"><button class="btn-danger" type="button" data-action="delete" data-id="${row.id}">🗑️</button></td>`}
        `;
        tbody.appendChild(tr);
      });

      if (historySip !== 'ALL') {
        tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
          btn.addEventListener('click', () => deleteSipRecord(historySip, btn.dataset.id));
        });
      }

      if (!rows.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${historySip === 'ALL' ? 4 : 6}">No SIP history found for this selection.</td>`;
        tbody.appendChild(tr);
      }
    }

    function historyRows() {
      if (historySip === 'ALL') {
        const merged = new Map();
        state.sips.forEach((sipName) => {
          (state.records[sipName] || []).forEach((row) => {
            const prev = merged.get(sipName) || { id: row.id, sipName, units: 0, amount: 0, date: 'Total' };
            prev.units += Number(row.units || 0);
            prev.amount += Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0)));
            merged.set(sipName, prev);
          });
        });
        tableHead.innerHTML = `
          <tr>
            <th>SIP</th>
            <th>Units</th>
            <th>Avg</th>
            <th>Invested Amt</th>
          </tr>
        `;
        return Array.from(merged.values())
          .map((r) => ({ ...r, nav: r.units > 0 ? r.amount / r.units : 0 }))
          .sort((a, b) => a.sipName.localeCompare(b.sipName));
      }

      const sipNames = [historySip];
      const merged = [];
      sipNames.forEach((sipName) => {
        (state.records[sipName] || []).forEach((row) => {
          merged.push({
            id: row.id,
            date: row.date,
            sipName,
            units: Number(row.units || 0),
            amount: Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0))),
            nav: Number(row.nav || 0),
          });
        });
      });
      tableHead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>SIP</th>
          <th>Units</th>
          <th>Avg</th>
          <th>Invested Amt</th>
          <th>Actions</th>
        </tr>
      `;
      return merged.sort((a, b) => a.date.localeCompare(b.date));
    }

    function syncInstallmentDateDisplay() {
      const dateInput = installmentForm.elements.date;
      const sip = installmentForm.elements.sipName.value;
      const minDate = minimumDateForSip(sip);
      dateInput.min = minDate;

      if (!isValidDate(dateInput.value) || dateInput.value < minDate || monthExists(sip, monthFromDate(dateInput.value))) {
        dateInput.value = nextInstallmentDate(sip);
      }
    }

    function nextInstallmentDate(sipName) {
      const minDate = minimumDateForSip(sipName);
      const records = (state.records[sipName] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      if (!records.length) return minDate;

      const latest = records[records.length - 1].date;
      const next = addMonth(month15(monthFromDate(latest)));
      return next > minDate ? next : minDate;
    }

    function minimumDateForSip(sipName) {
      return `${minimumMonthForSip(sipName)}-15`;
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

    function isValidDate(value) {
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    function monthFromDate(value) {
      return String(value || '').slice(0, 7);
    }

    function month15(month) {
      return `${month}-15`;
    }

    function addMonth(dateString) {
      const [y, m, d] = dateString.split('-').map(Number);
      if (!y || !m || !d) return dateString;
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCMonth(dt.getUTCMonth() + 1);
      return dt.toISOString().slice(0, 10);
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

      state.records[sipName].push(sanitized);
      if (window.PmsCapital) window.PmsCapital.adjustCash(-sanitized.amount);
      state.records[sipName].sort((a, b) => a.date.localeCompare(b.date));

      state.currentNav[sipName] = sanitized.nav;
      activeSip = sipName;
    }

    function monthExists(sipName, month) {
      return (state.records[sipName] || []).some((row) => monthFromDate(row.date) === month);
    }

    function deleteSipRecord(sipName, id) {
      const existing = state.records[sipName] || [];
      const removed = existing.find((row) => row.id === id);
      if (removed && window.PmsCapital) window.PmsCapital.adjustCash(Number(removed.amount || 0));
      state.records[sipName] = existing.filter((row) => row.id !== id);
      if (!state.records[sipName].length) {
        state.currentNav[sipName] = 0;
      }
      persist('SIP installment deleted.');
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
      return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
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
