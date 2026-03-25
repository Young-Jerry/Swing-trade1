import { saveData, subscribeData } from './firebase-db.js';

const defaultSips = ['SSIS', 'KSLY'];
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

let state = { sips: [...defaultSips], records: { SSIS: [], KSLY: [] }, currentNav: { SSIS: 0, KSLY: 0 }, activeSip: 'ALL_SIP' };
let activeSip = 'ALL_SIP';
let historySip = 'ALL';

subscribeData('mutualFunds', (data) => {
  const merged = normalizeState(data || state);
  state = merged;
  activeSip = state.activeSip && (state.activeSip === 'ALL_SIP' || state.sips.includes(state.activeSip)) ? state.activeSip : 'ALL_SIP';
  render();
});

bindEvents();

function bindEvents() {
  manualSipForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = clean(manualSipForm.elements.newSipName.value).toUpperCase();
    if (!name) return show('Enter a SIP name.');
    if (state.sips.includes(name)) return show('SIP already exists.');
    state.sips.push(name);
    state.records[name] = [];
    state.currentNav[name] = 0;
    activeSip = name;
    manualSipForm.reset();
    await persist('Manual SIP added.');
  });

  deleteSipBtn.addEventListener('click', async () => {
    if (!activeSip || activeSip === 'ALL_SIP') return show('Select a SIP to delete.');
    if (defaultSips.includes(activeSip)) return show('Default SIP cannot be deleted.');
    state.sips = state.sips.filter((s) => s !== activeSip);
    delete state.records[activeSip];
    delete state.currentNav[activeSip];
    activeSip = 'ALL_SIP';
    historySip = 'ALL';
    await persist('SIP deleted.');
  });

  installmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(installmentForm);
    const sipName = String(fd.get('sipName'));
    const month = String(fd.get('month'));
    const units = Math.floor(num(fd.get('units')));
    const nav = num(fd.get('nav'));
    if (!sipName || !month || !Number.isFinite(units) || !Number.isFinite(nav) || units <= 0 || nav <= 0) return show('Invalid data.');
    state.records[sipName] = state.records[sipName] || [];
    state.records[sipName].push({ id: crypto.randomUUID(), date: `${month}-15`, units, nav, amount: units * nav });
    state.records[sipName].sort((a, b) => a.date.localeCompare(b.date));
    installmentForm.reset();
    await persist('Installment added.');
  });

  navForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(navForm);
    const sipName = String(fd.get('sipName'));
    const nav = num(fd.get('nav'));
    if (!Number.isFinite(nav) || nav <= 0) return;
    state.currentNav[sipName] = nav;
    await persist('NAV updated.');
  });

  historySipSelect.addEventListener('change', () => { historySip = historySipSelect.value; renderHistory(); });
}

function render() {
  tabs.innerHTML = '';
  tabs.appendChild(tabButton('ALL_SIP', 'All SIP'));
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
      <td>${historySip === 'ALL' ? `<button class="btn-secondary" data-action="viewSip" data-sip="${row.sipName}">View</button>` : `<button class="btn-danger" data-action="deleteRow" data-sip="${row.sipName}" data-id="${row.id}">Delete</button>`}</td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-action="viewSip"]').forEach((btn) => btn.addEventListener('click', () => { historySip = btn.dataset.sip; historySipSelect.value = historySip; renderHistory(); }));
  tbody.querySelectorAll('button[data-action="deleteRow"]').forEach((btn) => btn.addEventListener('click', async () => {
    const sip = btn.dataset.sip; const id = btn.dataset.id;
    state.records[sip] = (state.records[sip] || []).filter((row) => row.id !== id);
    await persist('SIP history row deleted.');
  }));

  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${historySip === 'ALL' ? 5 : 6}">No SIP history found for this selection.</td>`;
    tbody.appendChild(tr);
  }
}

function historyRows() {
  if (historySip === 'ALL') {
    tableHead.innerHTML = '<tr><th>SIP</th><th>Units</th><th>NAV</th><th>Amount</th><th>Action</th></tr>';
    return state.sips.map((sipName) => {
      const rows = state.records[sipName] || [];
      const units = rows.reduce((s, r) => s + Number(r.units || 0), 0);
      const amount = rows.reduce((s, r) => s + Number(r.amount || (r.units * r.nav)), 0);
      return { id: sipName, sipName, units, amount, nav: units ? amount / units : 0 };
    }).filter((r) => r.units > 0 || r.amount > 0);
  }

  tableHead.innerHTML = '<tr><th>Date</th><th>SIP</th><th>Units</th><th>NAV</th><th>Amount</th><th>Action</th></tr>';
  return (state.records[historySip] || []).map((row) => ({ ...row, sipName: historySip, amount: Number(row.amount || row.units * row.nav) }));
}

function tabButton(value, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn-secondary ${value === activeSip ? 'active' : ''}`;
  btn.textContent = label;
  btn.onclick = async () => { activeSip = value; await persist('Saved ✓'); };
  return btn;
}

function fillSipSelects() {
  const selects = [...document.querySelectorAll('form select[name="sipName"]')];
  selects.forEach((select) => {
    select.innerHTML = state.sips.map((name) => `<option value="${name}">${name}</option>`).join('');
    select.value = activeSip === 'ALL_SIP' ? (state.sips[0] || '') : activeSip;
    select.onchange = () => { activeSip = select.value; render(); };
  });
  historySipSelect.innerHTML = ['<option value="ALL">All SIPs</option>'].concat(state.sips.map((name) => `<option value="${name}">${name}</option>`)).join('');
  historySipSelect.value = historySip;
}

function normalizeState(input) {
  const sips = Array.from(new Set([...(input.sips || []), ...defaultSips]));
  const records = {};
  const currentNav = {};
  sips.forEach((sip) => {
    records[sip] = Array.isArray((input.records || {})[sip]) ? (input.records[sip]) : [];
    currentNav[sip] = Number((input.currentNav || {})[sip] || 0);
  });
  return { sips, records, currentNav, activeSip: input.activeSip || 'ALL_SIP' };
}

async function persist(message = 'Saved ✓') {
  state = normalizeState(state);
  state.activeSip = activeSip;
  await saveData('mutualFunds', state);
  show(message);
}

function latestNav(sip) { const rows = state.records[sip] || []; return rows.length ? Number(rows[rows.length - 1].nav || 0) : 0; }
function show(text) { msg.textContent = text; }
function clean(v) { return String(v || '').trim(); }
function num(v) { return Number.parseFloat(v); }
function currency(value) { return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`; }
function fmtUnits(value) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0)); }
function fmtNav(value) { return Number(value || 0).toFixed(4); }
