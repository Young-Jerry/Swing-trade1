(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;
    const NEPSE_MIN_COMMISSION = 10;
    const SEBON_RATE = 0.00015;
    const DP_CHARGE = 25;

    const action = document.getElementById('action');
    const purchasePrice = document.getElementById('purchasePrice');
    const shares = document.getElementById('shares');
    const sellingPrice = document.getElementById('sellingPrice');
    const sellingWrap = document.getElementById('sellingWrap');

    [action, purchasePrice, shares, sellingPrice].forEach((el) => {
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    calculate();

    function calculate() {
      const side = action.value;
      const qty = num(shares.value);
      const buy = num(purchasePrice.value);
      const sell = num(sellingPrice.value);

      sellingWrap.style.display = side === 'sell' ? 'flex' : 'none';

      if (!valid(qty) || !valid(buy) || (side === 'sell' && !valid(sell))) {
        setResults(0, 0, 0, 0, 0);
        return;
      }

      const unitPrice = side === 'buy' ? buy : sell;
      const totalAmount = unitPrice * qty;
      const commission = calculateCommission(totalAmount);
      const sebonFee = totalAmount * SEBON_RATE;
      const totalPayable = side === 'buy'
        ? totalAmount + commission + sebonFee + DP_CHARGE
        : totalAmount - commission - sebonFee - DP_CHARGE;
      const costPerShare = qty > 0 ? totalPayable / qty : 0;

      setResults(totalAmount, commission, sebonFee, totalPayable, costPerShare);
    }

    function setResults(totalAmount, commission, sebonFee, totalPayable, costPerShare) {
      text('transactionAmount', money(totalAmount));
      text('commission', money(commission));
      text('sebonFee', money(sebonFee));
      text('dpCharge', DP_CHARGE.toFixed(2));
      text('totalPayable', money(totalPayable));
      text('costPerShare', money(costPerShare));
    }

    function calculateCommission(amount) {
      const rate = brokerRate(amount);
      return Math.max(NEPSE_MIN_COMMISSION, amount * rate);
    }

    function brokerRate(amount) {
      if (amount <= 50000) return 0.0036;
      if (amount <= 500000) return 0.0033;
      if (amount <= 2000000) return 0.0031;
      if (amount <= 10000000) return 0.0027;
      return 0.0024;
    }

    function text(id, value) {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    }

    function money(v) {
      return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(v || 0)}`;
    }

    function num(v) {
      return Number.parseFloat(v);
    }

    function valid(v) {
      return Number.isFinite(v) && v > 0;
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
