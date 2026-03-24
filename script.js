// script.js - Dashboard logic
document.addEventListener('DOMContentLoaded', () => {
  updateDashboard();
});

function updateDashboard() {
  const trades = JSON.parse(localStorage.getItem('trades') || '[]');
  const longterm = JSON.parse(localStorage.getItem('longterm') || '[]');
  const mf = JSON.parse(localStorage.getItem('mf') || '[]');

  const totalTrades = sumPortfolio(trades);
  const totalLongTerm = sumPortfolio(longterm);
  const totalMF = sumPortfolio(mf);
  const combined = totalTrades + totalLongTerm + totalMF;

  document.getElementById('totalTrades').textContent = `Total Trades: ₨${formatNepaliNumber(totalTrades)}`;
  document.getElementById('totalLongTerm').textContent = `Total Long Term: ₨${formatNepaliNumber(totalLongTerm)}`;
  document.getElementById('totalMF').textContent = `Total Mutual Funds: ₨${formatNepaliNumber(totalMF)}`;
  document.getElementById('combinedTotal').textContent = `Combined Total: ₨${formatNepaliNumber(combined)}`;

  // Update pie chart placeholder or integrate a chart library if needed
}

function sumPortfolio(portfolio) {
  return portfolio.reduce((sum, item) => sum + (item['LTP'] * item['Qty']), 0);
}

function formatNepaliNumber(number) {
  return number.toLocaleString('ne-NP');
}
