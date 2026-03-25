import { saveData, subscribeData, deleteData } from './firebase-db.js';

const exitForm = document.getElementById('exitForm');
const exitType = document.getElementById('exitType');
const exitRecord = document.getElementById('exitRecord');
const soldPriceInput = document.getElementById('soldPrice');
const holdingDaysInput = document.getElementById('holdingDays');
const exitedBody = document.querySelector('#exitedTable tbody');

let trades = {};
let longterm = {};
let mutualFunds = { records: {}, currentNav: {} };
let pastTrades = {};

subscribeData('trades', (data) => { trades = data || {}; renderRecordOptions(); });
subscribeData('longterm', (data) => { longterm = data || {}; renderRecordOptions(); });
subscribeData('mutualFunds', (data) => { mutualFunds = data || { records: {}, currentNav: {} }; renderRecordOptions(); });
subscribeData('pastTrades', (data) => { pastTrades = data || {}; renderExited(); });

exitType.addEventListener('change', renderRecordOptions);
exitForm.addEventListener('submit', onExitSubmit);

async function onExitSubmit(e) {
  e.preventDefault();
  const type = exitType.value;
  const recordId = exitRecord.value;
  const soldPrice = Number(soldPriceInput.value);
  const holdingDays = Math.floor(Number(holdingDaysInput.value));
  if (!recordId || !Number.isFinite(soldPrice) || soldPrice <= 0 || !Number.isFinite(holdingDays) || holdingDays < 0) return;

  const active = getActiveRecords(type);
  const record = active.find((item) => item.id === recordId);
  if (!record) return;

  const profit = (soldPrice - record.buyPrice) * record.qty;
  const perDayProfit = holdingDays > 0 ? profit / holdingDays : profit;

  pastTrades[crypto.randomUUID()] = {
    type: record.source,
    name: record.name,
    qty: record.qty,
    buyPrice: record.buyPrice,
    soldPrice,
    profit,
    perDayProfit,
    holdingDays,
  };
  await saveData('pastTrades', pastTrades);
  await removeRecord(record);

  soldPriceInput.value = '';
  holdingDaysInput.value = '';
}

function renderRecordOptions() {
  const type = exitType.value;
  const records = getActiveRecords(type);
  exitRecord.innerHTML = records.map((row) => `<option value="${row.id}">${escapeHtml(row.name)} — Qty/Units: ${fmtQty(row.qty)}</option>`).join('');
  if (!records.length) exitRecord.innerHTML = '<option value="">No records available</option>';
}

function renderExited() {
  const rows = Object.entries(pastTrades || {}).map(([id, row]) => ({ id, ...row }));
  exitedBody.innerHTML = '';

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.type}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${currency(row.buyPrice)}</td>
      <td>${currency(row.soldPrice || row.currentPrice || 0)}</td>
      <td class="${profitClass(row.profit)}">${currency(row.profit)}</td>
      <td class="${profitClass(row.perDayProfit)}">${currency(row.perDayProfit)}</td>
      <td>${Math.floor(Number(row.holdingDays || 0))}</td>
      <td class="actions-cell">
        <button class="btn-secondary" data-action="edit" data-id="${row.id}">Edit</button>
        <button class="btn-danger" data-action="delete" data-id="${row.id}">Delete</button>
      </td>
    `;
    exitedBody.appendChild(tr);
  });

  exitedBody.querySelectorAll('button[data-action="edit"]').forEach((btn) => btn.addEventListener('click', () => editExited(btn.dataset.id)));
  exitedBody.querySelectorAll('button[data-action="delete"]').forEach((btn) => btn.addEventListener('click', () => deleteExited(btn.dataset.id)));

  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8">No exited trades yet.</td>';
    exitedBody.appendChild(tr);
  }
}

async function editExited(id) {
  const row = pastTrades[id];
  if (!row) return;
  const holdingDays = prompt('Holding Days', String(row.holdingDays));
  if (holdingDays === null) return;
  const parsed = Math.floor(Number(holdingDays));
  if (!Number.isFinite(parsed) || parsed < 0) return;
  row.holdingDays = parsed;
  row.perDayProfit = parsed > 0 ? row.profit / parsed : row.profit;
  await saveData('pastTrades', pastTrades);
}

async function deleteExited(id) {
  await deleteData(`pastTrades/${id}`);
}

function getActiveRecords(type) {
  const tradeRows = Object.entries(trades || {}).map(([id, row]) => ({ id: `t-${id}`, rawId: id, source: 'Trade', name: row.script || 'Trade', qty: Number(row.qty || 0), buyPrice: Number(row.wacc || 0), ref: 'trades' }));
  const longtermRows = Object.entries(longterm || {}).map(([id, row]) => ({ id: `l-${id}`, rawId: id, source: 'Long Term', name: row.script || 'Holding', qty: Number(row.qty || 0), buyPrice: Number(row.wacc || 0), ref: 'longterm' }));
  const sipRows = [];
  Object.entries(mutualFunds.records || {}).forEach(([sipName, records]) => {
    (records || []).forEach((row) => sipRows.push({ id: `s-${sipName}-${row.id}`, rawId: row.id, sipName, source: 'SIP', name: sipName, qty: Number(row.units || 0), buyPrice: Number(row.nav || 0), ref: 'sip' }));
  });

  if (type === 'trades') return tradeRows;
  if (type === 'longterm') return longtermRows;
  if (type === 'sip') return sipRows;
  return [];
}

async function removeRecord(record) {
  if (record.ref === 'trades' || record.ref === 'longterm') {
    await deleteData(`${record.ref}/${record.rawId}`);
    return;
  }
  const next = JSON.parse(JSON.stringify(mutualFunds || { records: {} }));
  next.records = next.records || {};
  next.records[record.sipName] = (next.records[record.sipName] || []).filter((r) => r.id !== record.rawId);
  await saveData('mutualFunds', next);
}

function fmtQty(value) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0); }
function currency(value) { return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`; }
function profitClass(value) { return Number(value || 0) >= 0 ? 'value-profit' : 'value-loss'; }
function escapeHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
