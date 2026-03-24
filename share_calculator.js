// share_calculator.js
document.getElementById('calculateBtn').addEventListener('click', () => {
  const action = document.getElementById('action').value;
  const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
  const shares = parseInt(document.getElementById('shares').value);
  const sellingPrice = parseFloat(document.getElementById('sellingPrice').value);

  if (isNaN(purchasePrice) || isNaN(shares) || (action==='sell' && isNaN(sellingPrice))) {
    alert('Please fill all required fields correctly.');
    return;
  }

  const transactionAmt = (action === 'buy') ? purchasePrice * shares : sellingPrice * shares;

  // Commission tiers
  let commissionRate = 0;
  if (transactionAmt <= 50000) commissionRate = 0.004;
  else if (transactionAmt <= 500000) commissionRate = 0.0037;
  else if (transactionAmt <= 2000000) commissionRate = 0.0034;
  else if (transactionAmt <= 10000000) commissionRate = 0.003;
  else commissionRate = 0.0027;

  const commission = transactionAmt * commissionRate;
  const sebonFee = transactionAmt * 0.00015;
  const totalAmt = transactionAmt + commission + (action==='buy'?0:0);
  const totalPayable = totalAmt + 25 + sebonFee;

  const costPerShare = purchasePrice;

  document.getElementById('totalAmt').textContent = `₨${formatNepaliNumber(transactionAmt)}`;
  document.getElementById('commission').textContent = `₨${formatNepaliNumber(commission)}`;
  document.getElementById('sebonFee').textContent = `₨${formatNepaliNumber(sebonFee)}`;
  document.getElementById('totalPayable').textContent = `₨${formatNepaliNumber(totalPayable)}`;
  document.getElementById('costPerShare').textContent = `₨${formatNepaliNumber(costPerShare)}`;
});

function formatNepaliNumber(number) {
  return number.toLocaleString('ne-NP');
}
