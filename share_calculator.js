(() => {
  const action = document.getElementById('action');
  const purchasePrice = document.getElementById('purchasePrice');
  const shares = document.getElementById('shares');
  const sellingPrice = document.getElementById('sellingPrice');
  const sellingWrap = document.getElementById('sellingWrap');

  [action, purchasePrice, shares, sellingPrice].forEach((el) => {
    el.addEventListener('input', calculate);
  });

  calculate();

  function calculate() {
    const side = action.value;
    const buy = num(purchasePrice.value);
    const qty = num(shares.value);
    const sell = num(sellingPrice.value);

    sellingWrap.style.display = side === 'sell' ? 'flex' : 'none';

    const usedPrice = side === 'sell' ? sell : buy;
    if (!valid(buy) || !valid(qty) || (side === 'sell' && !valid(sell))) {
      setResults(0, 0, 0, 25, 0, 0);
      return;
    }

    const transaction = usedPrice * qty;
    const commission = transaction * brokerRate(transaction);
    const sebon = transaction * 0.00015;
    const dp = 25;
    const totalPayable = transaction + commission + sebon + dp;
    const cps = totalPayable / qty;

    setResults(transaction, commission, sebon, dp, totalPayable, cps);
  }

  function setResults(transaction, commission, sebon, dp, payable, cps) {
    text('transactionAmount', money(transaction));
    text('commission', money(commission));
    text('sebonFee', money(sebon));
    text('dpCharge', money(dp));
    text('totalPayable', money(payable));
    text('costPerShare', money(cps));
  }

  function brokerRate(amount) {
    if (amount <= 50000) return 0.004;
    if (amount <= 500000) return 0.0037;
    if (amount <= 2000000) return 0.0034;
    if (amount <= 10000000) return 0.003;
    return 0.0027;
  }

  function text(id, value) {
    document.getElementById(id).textContent = value;
  }

  function money(v) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(v || 0)}`;
  }

  function num(v) { return Number.parseFloat(v); }
  function valid(v) { return Number.isFinite(v) && v > 0; }
})();
