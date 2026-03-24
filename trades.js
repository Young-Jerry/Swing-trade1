// trades.js
const tradeStorageKey = 'trades';

let trades = [];

document.addEventListener('DOMContentLoaded', () => {
  loadTrades();
  document.getElementById('addTradeForm').addEventListener('submit', addTrade);
  document.querySelectorAll('#tradeTable th').forEach(th => {
    th.addEventListener('click', () => {
      sortTable(th.dataset.sort);
    });
  });
});

function loadTrades() {
  trades = JSON.parse(localStorage.getItem(tradeStorageKey) || '[]');
  renderTable();
  updateSummary();
}

function saveTrades() {
  localStorage.setItem(tradeStorageKey, JSON.stringify(trades));
  renderTable();
  updateSummary();
  updateDashboard();
}

function renderTable() {
  const tbody = document.querySelector('#tradeTable tbody');
  tbody.innerHTML = '';
  trades.sort((a, b) => a.script.localeCompare(b.script));
  trades.forEach((trade, index) => {
    const row = document.createElement('tr');

    // Script
    const scriptCell = document.createElement('td');
    scriptCell.contentEditable = true;
    scriptCell.textContent = trade.script;
    scriptCell.addEventListener('blur', () => {
      trades[index].script = scriptCell.textContent;
      saveTrades();
    });
    row.appendChild(scriptCell);

    // Sector
    const sectorCell = document.createElement('td');
    sectorCell.contentEditable = true;
    sectorCell.textContent = trade.sector;
    sectorCell.addEventListener('blur', () => {
      trades[index].sector = sectorCell.textContent;
      saveTrades();
    });
    row.appendChild(sectorCell);

    // LTP
    const ltpCell = document.createElement('td');
    ltpCell.contentEditable = true;
    ltpCell.textContent = trade.LTP;
    ltpCell.addEventListener('blur', () => {
      trades[index].LTP = parseFloat(ltpCell.textContent);
      saveTrades();
    });
    row.appendChild(ltpCell);

    // Sell Range
    const sellRangeCell = document.createElement('td');
    sellRangeCell.innerHTML = `
      <input type="number" class="sell1" value="${trade.SELL1}" step="0.01" style="width:80px;"/>
      <input type="number" class="sell2" value="${(trade.SELL1*1.1).toFixed(2)}" step="0.01" style="width:80px;" readonly/>
    `;
    // Update SELL2 dynamically
    sellRangeCell.querySelector('.sell1').addEventListener('input', (e) => {
      const sell1Val = parseFloat(e.target.value);
      const sell2Val = (sell1Val * 1.1).toFixed(2);
      sellRangeCell.querySelector('.sell2').value = sell2Val;
      trades[index].SELL1 = sell1Val;
      saveTrades();
    });
    row.appendChild(sellRangeCell);

    // Distance
    const distance = trade.LTP - trade.SELL1;
    const distanceCell = document.createElement('td');
    distanceCell.textContent = distance.toFixed(2);
    row.appendChild(distanceCell);

    // Current value
    const currentValue = trade.LTP * trade.QTY;
    const currentCell = document.createElement('td');
    currentCell.textContent = `₨${formatNepaliNumber(currentValue)}`;
    row.appendChild(currentCell);

    // P/L
    const pl = (trade.LTP - trade.WACC) * trade.QTY;
    const plCell = document.createElement('td');
    plCell.textContent = `₨${formatNepaliNumber(pl)}`;
    plCell.style.color = pl >= 0 ? 'green' : 'red';
    row.appendChild(plCell);

    // Actions
    const actionsCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      if(confirm('Delete this trade?')){
        trades.splice(index,1);
        saveTrades();
      }
    };
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);

    // Apply row highlight if LTP >= SELL1
    if (trade.LTP >= trade.SELL1) {
      row.style.backgroundColor = '#FFD700'; // Gold
    }
    tbody.appendChild(row);
  });
}

function updateSummary() {
  let totalInvested = 0;
  let totalCurrent = 0;
  let totalPL = 0;
  trades.forEach(t => {
    totalInvested += t.WACC * t.QTY;
    totalCurrent += t.LTP * t.QTY;
    totalPL += (t.LTP - t.WACC) * t.QTY;
  });
  document.getElementById('totalInvested').textContent = `₨${formatNepaliNumber(totalInvested)}`;
  document.getElementById('totalCurrent').textContent = `₨${formatNepaliNumber(totalCurrent)}`;
  document.getElementById('totalPL').textContent = `₨${formatNepaliNumber(totalPL)}`;
}

function addTrade(e) {
  e.preventDefault();
  const script = document.getElementById('script').value.trim();
  const sector = document.getElementById('sector').value.trim();
  const LTP = parseFloat(document.getElementById('ltp').value);
  const SELL1 = parseFloat(document.getElementById('sell1').value);
  const SELL2 = SELL1 * 1.1;
  const newTrade = {
    script,
    sector,
    LTP,
    SELL1,
    SELL2,
    Qty: 0,
    WACC: 0
  };
  trades.push(newTrade);
  saveTrades();
  document.getElementById('addTradeForm').reset();
}

function sortTable(sortBy) {
  trades.sort((a,b) => {
    if (sortBy === 'script') return a.script.localeCompare(b.script);
    if (sortBy === 'sector') return a.sector.localeCompare(b.sector);
    if (sortBy === 'ltp') return a.LTP - b.LTP;
    if (sortBy === 'sellRange') return a.SELL1 - b.SELL1;
    if (sortBy === 'distance') return (a.LTP - a.SELL1) - (b.LTP - b.SELL1);
    if (sortBy === 'current') return (a.LTP * a.QTY) - (b.LTP * b.QTY);
    if (sortBy === 'pl') return ((a.LTP - a.WACC) * a.QTY) - ((b.LTP - b.WACC) * b.QTY);
    return 0;
  });
  renderTable();
}
function formatNepaliNumber(number) {
  return number.toLocaleString('ne-NP');
}
