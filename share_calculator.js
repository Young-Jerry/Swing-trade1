(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;

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
      const tx = math().calculateTransaction(side, unitPrice, qty);

      setResults(tx.totalAmount, tx.commission, tx.sebonFee, tx.totalPayable, tx.costPerShare);
    }

    function setResults(totalAmount, commission, sebonFee, totalPayable, costPerShare) {
      text('transactionAmount', money(totalAmount));
      text('commission', money(commission));
      text('sebonFee', money(sebonFee));
      text('dpCharge', math().DP_CHARGE.toFixed(2));
      text('totalPayable', money(totalPayable));
      text('costPerShare', money(costPerShare));
    }


    function math() {
      return window.PmsTradeMath || {
        DP_CHARGE: 25,
        calculateTransaction: (side, price, qty) => {
          const totalAmount = Number(price || 0) * Number(qty || 0);
          const commission = 10;
          const sebonFee = totalAmount * 0.00015;
          const totalPayable = side === 'sell'
            ? totalAmount - commission - sebonFee - 25
            : totalAmount + commission + sebonFee + 25;
          return { totalAmount, commission, sebonFee, totalPayable, costPerShare: qty > 0 ? totalPayable / qty : 0 };
        },
      };
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
