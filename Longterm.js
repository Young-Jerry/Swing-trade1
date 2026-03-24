// longterm.js
const longtermStorageKey = 'longterm';

let holdings = [];

document.addEventListener('DOMContentLoaded', () => {
  loadHoldings();
  document.getElementById('addLongTermForm').addEventListener('submit', addHolding);
  document.querySelectorAll('#longtermTable th').forEach(th => {
    th.addEventListener('click', () => {
      sortTable(th.dataset.sort);
    });
  });
});

function loadHoldings() {
  holdings = JSON.parse(localStorage.getItem(longtermStorageKey) || '[]');
  renderTable();
  updateSummary();
}

function saveHoldings() {
  localStorage.setItem(longtermStorageKey, JSON.stringify(holdings));
  renderTable();
  updateSummary();
  updateDashboard();
}

function renderTable() {
  const tbody = document.querySelector('#longtermTable tbody');
  tbody.innerHTML = '';
  holdings.sort((a,b) => a.script.localeCompare(b.script));
  holdings.forEach((hold, index) => {
    const row = document.createElement('tr');

    // Script
    const scriptCell = document.createElement('td');
    scriptCell.contentEditable = true;
    scriptCell.textContent = hold.script;
    scriptCell.addEventListener('blur', () => {
      holdings[index].script = scriptCell.textContent;
      saveHoldings();
    });
    row.appendChild(scriptCell);

    // Sector
    const sectorCell = document.createElement('td');
    sectorCell.contentEditable = true;
    sectorCell.textContent = hold.sector;
    sectorCell.addEventListener('blur', () => {
      holdings[index].sector = sectorCell.textContent;
      saveHoldings();
    });
    row.appendChild(sectorCell);

    // LTP
    const ltpCell = document.createElement('td');
    ltpCell.contentEditable = true;
    ltpCell.textContent = hold.LTP;
    ltpCell.addEventListener('blur', () => {
      holdings[index].LTP = parseFloat(ltpCell.textContent);
      saveHoldings();
    });
    row.appendChild(ltpCell);

    // Quantity
    const qtyCell = document.createElement('td');
    qtyCell.contentEditable = true;
    qtyCell.textContent = hold.QTY;
    qtyCell.addEventListener('blur', () => {
      holdings[index].QTY = parseFloat(qtyCell.textContent);
      saveHoldings();
    });
    row.appendChild(qtyCell);

    // WACC
    const waccCell = document.createElement('td');
    waccCell.contentEditable = true;
    waccCell.textContent = hold.WACC;
    waccCell.addEventListener('blur', () => {
      holdings[index].WACC = parseFloat(waccCell.textContent);
      saveHoldings();
    });
    row.appendChild(waccCell);

    // Current value
    const currVal = hold.LTP * hold.QTY;
    const currentCell = document.createElement('td');
    currentCell.textContent = `₨${formatNepaliNumber(currVal)}`;
    row.appendChild(currentCell);

    // P/L
    const pl = (hold.LTP - hold.WACC) * hold.QTY;
    const plCell = document.createElement('td');
    plCell.textContent = `₨${formatNepaliNumber(pl)}`;
    plCell.style.color = pl >= 0 ? 'green' : 'red';
    row.appendChild(plCell);

    // Actions
    const actionsCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      if(confirm('Delete this entry?')){
        holdings.splice(index,1);
        saveHoldings();
      }
    };
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);

    // Highlight if LTP >= WACC
    if (hold.LTP >= hold.WACC) {
      row.style.backgroundColor = '#FFD700'; // Gold
    }
    tbody.appendChild(row);
  });
}

function updateSummary() {
  let totalInvested = 0;
  let totalCurrent = 0;
  let totalPL = 0;
  holdings.forEach(h => {
    totalInvested += h.WACC * h.QTY;
    totalCurrent += h.LTP * h.QTY;
    totalPL += (h.LTP - h.WACC) * h.QTY;
  });
  document.getElementById('totalInvested').textContent = `₨${formatNepaliNumber(totalInvested)}`;
  document.getElementById('totalCurrent').textContent = `₨${formatNepaliNumber(totalCurrent)}`;
  document.getElementById('totalPL').textContent = `₨${formatNepaliNumber(totalPL)}`;
}

function addHolding(e) {
  e.preventDefault();
  const script = document.getElementById('script').value.trim();
  const sector = document.getElementById('sector').value.trim();
  const LTP = parseFloat(document.getElementById('ltp').value);
  const QTY = parseFloat(document.getElementById('qty').value);
  const WACC = parseFloat(document.getElementById('wacc').value);
  const newHold = { script, sector, LTP, QTY, WACC };
  holdings.push(newHold);
  saveHoldings();
  document.getElementById('addLongTermForm').reset();
}

function sortTable(sortBy) {
  holdings.sort((a,b) => {
    if (sortBy === 'script') return a.script.localeCompare(b.script);
    if (sortBy === 'sector') return a.sector.localeCompare(b.sector);
    if (sortBy === 'ltp') return a.LTP - b.LTP;
    if (sortBy === 'qty') return a.QTY - b.QTY;
    if (sortBy === 'wacc') return a.WACC - b.WACC;
    if (sortBy === 'current') return (a.LTP * a.QTY) - (b.LTP * b.QTY);
    if (sortBy === 'pl') return ((a.LTP - a.WACC) * a.QTY) - ((b.LTP - b.WACC) * b.QTY);
    return 0;
  });
  renderTable();
}
function formatNepaliNumber(number) {
  return number.toLocaleString('ne-NP');
}
