// mf.js
const mfStorageKey = 'mf';

let mfPortfolio = [];

document.addEventListener('DOMContentLoaded', () => {
  loadMF();
  document.getElementById('addMFForm').addEventListener('submit', addMF);
  document.querySelectorAll('#mfTable th').forEach(th => {
    th.addEventListener('click', () => {
      sortTable(th.dataset.sort);
    });
  });
});

function loadMF() {
  mfPortfolio = JSON.parse(localStorage.getItem(mfStorageKey) || '[]');
  renderTable();
  updateSummary();
}

function saveMF() {
  localStorage.setItem(mfStorageKey, JSON.stringify(mfPortfolio));
  renderTable();
  updateSummary();
  updateDashboard();
}

function renderTable() {
  const tbody = document.querySelector('#mfTable tbody');
  tbody.innerHTML = '';
  mfPortfolio.sort((a, b) => a.script.localeCompare(b.script));
  mfPortfolio.forEach((mf, index) => {
    const row = document.createElement('tr');

    // Script
    const scriptCell = document.createElement('td');
    scriptCell.contentEditable = true;
    scriptCell.textContent = mf.script;
    scriptCell.addEventListener('blur', () => {
      mfPortfolio[index].script = scriptCell.textContent;
      saveMF();
    });
    row.appendChild(scriptCell);

    // Sector
    const sectorCell = document.createElement('td');
    sectorCell.contentEditable = true;
    sectorCell.textContent = mf.sector;
    sectorCell.addEventListener('blur', () => {
      mfPortfolio[index].sector = sectorCell.textContent;
      saveMF();
    });
    row.appendChild(sectorCell);

    // LTP
    const ltpCell = document.createElement('td');
    ltpCell.contentEditable = true;
    ltpCell.textContent = mf.LTP;
    ltpCell.addEventListener('blur', () => {
      mfPortfolio[index].LTP = parseFloat(ltpCell.textContent);
      saveMF();
    });
    row.appendChild(ltpCell);

    // Quantity
    const qtyCell = document.createElement('td');
    qtyCell.contentEditable = true;
    qtyCell.textContent = mf.QTY;
    qtyCell.addEventListener('blur', () => {
      mfPortfolio[index].QTY = parseFloat(qtyCell.textContent);
      saveMF();
    });
    row.appendChild(qtyCell);

    // Current value
    const currVal = mf.LTP * mf.QTY;
    const currentCell = document.createElement('td');
    currentCell.textContent = `₨${formatNepaliNumber(currVal)}`;
    row.appendChild(currentCell);

    // P/L
    const pl = (mf.LTP - 0) * mf.QTY; // WACC not used here
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
        mfPortfolio.splice(index,1);
        saveMF();
      }
    };
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });
}

function updateSummary() {
  let totalInvested = 0;
  let totalCurrent = 0;
  let totalPL = 0;
  mfPortfolio.forEach(mf => {
    totalInvested += mf.WACC * mf.QTY;
    totalCurrent += mf.LTP * mf.QTY;
    totalPL += (mf.LTP - 0) * mf.QTY; // WACC not used
  });
  document.getElementById('totalInvested').textContent = `₨${formatNepaliNumber(totalInvested)}`;
  document.getElementById('totalCurrent').textContent = `₨${formatNepaliNumber(totalCurrent)}`;
  document.getElementById('totalPL').textContent = `₨${formatNepaliNumber(totalPL)}`;
}

function addMF(e) {
  e.preventDefault();
  const script = document.getElementById('script').value.trim();
  const sector = document.getElementById('sector').value.trim();
  const LTP = parseFloat(document.getElementById('ltp').value);
  const QTY = parseFloat(document.getElementById('qty').value);
  const newMF = { script, sector, LTP, QTY };
  mfPortfolio.push(newMF);
  saveMF();
  document.getElementById('addMFForm').reset();
}

function sortTable(sortBy) {
  mfPortfolio.sort((a,b) => {
    if (sortBy === 'script') return a.script.localeCompare(b.script);
    if (sortBy === 'sector') return a.sector.localeCompare(b.sector);
    if (sortBy === 'ltp') return a.LTP - b.LTP;
    if (sortBy === 'qty') return a.QTY - b.QTY;
    if (sortBy === 'current') return (a.LTP * a.QTY) - (b.LTP * b.QTY);
    if (sortBy === 'pl') return ((a.LTP) * a.QTY) - ((b.LTP) * b.QTY);
    return 0;
  });
  renderTable();
}
function formatNepaliNumber(number) {
  return number.toLocaleString('ne-NP');
}
