(() => {
  let booted = false;

  const boot = () => {
    if (booted) return;
    booted = true;

    const action = document.getElementById('action');
    const purchasePrice = document.getElementById('purchasePrice');
    const shares = document.getElementById('shares');
    const sellingPrice = document.getElementById('sellingPrice');
    const holdingDays = document.getElementById('holdingDays');
    const sellingWrap = document.getElementById('sellingWrap');
    const holdingDaysWrap = document.getElementById('holdingDaysWrap');
    const buyIsWacc = document.getElementById('buyIsWacc');
    const capitalGainRow = document.getElementById('capitalGainRow');
    const receivableRow = document.getElementById('receivableRow');

    [action, purchasePrice, shares, sellingPrice, buyIsWacc, holdingDays].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    calculate();

    function calculate() {
      const side = action.value;
      const qty = num(shares.value);
      const buy = num(purchasePrice.value);
      const sell = num(sellingPrice.value);
      const days = Math.max(0, Math.floor(num(holdingDays.value) || 0));

      sellingWrap.style.display = side === 'sell' ? 'flex' : 'none';
      if (holdingDaysWrap) holdingDaysWrap.style.display = side === 'sell' ? 'flex' : 'none';
      capitalGainRow.style.display = side === 'sell' ? 'flex' : 'none';
      receivableRow.style.display = side === 'sell' ? 'flex' : 'none';

      if (!valid(qty) || !valid(buy) || (side === 'sell' && !valid(sell))) {
        setResults({ totalAmount: 0, commission: 0, sebonFee: 0, dpCharge: math().DP_CHARGE, totalPayable: 0, costPerShare: 0 }, 0, 0, 0);
        return;
      }

      const unitPrice = side === 'buy' ? buy : sell;
      const tx = math().calculateTransaction(side, unitPrice, qty, { buyIsWacc: buyIsWacc.checked && side === 'buy' });

      let capitalGain = 0;
      let totalReceivable = 0;
      let taxRate = 0;

      if (side === 'sell') {
        const roundTrip = math().calculateRoundTrip({
          buyPrice: buy,
          soldPrice: sell,
          qty,
          buyIsWacc: buyIsWacc.checked,
          holdingDays: days,
        });
        capitalGain = Number(roundTrip.capitalGainTax || 0);
        totalReceivable = Number(roundTrip.netRealizedAmount || 0);
        taxRate = Number(roundTrip.capitalGainTaxRate || 0);
      }

      setResults(tx, capitalGain, totalReceivable, taxRate);
    }

    function setResults(tx, capitalGain, totalReceivable, taxRate) {
      text('transactionAmount', money(tx.totalAmount));
      text('commission', money(tx.commission));
      text('sebonFee', money(tx.sebonFee));
      text('dpCharge', money(tx.dpCharge));
      text('totalPayable', money(tx.totalPayable));
      text('costPerShare', money(tx.costPerShare));
      text('capitalGain', money(capitalGain));
      text('totalReceivable', money(totalReceivable));
      text('commissionNote', `* Commission Amount includes NEPSE Commission Rs ${fmt(tx.commission)} & SEBON Regularity Fee Rs ${fmt(tx.sebonFee)}.${taxRate ? ` Tax rate: ${(taxRate * 100).toFixed(1)}%` : ''}`);
    }

    function math() {
      if (window.PmsTradeMath) return window.PmsTradeMath;
      const fallbackCalculateTransaction = (side, price, qty) => {
        const totalAmount = Number(price || 0) * Number(qty || 0);
        const commission = 10;
        const sebonFee = totalAmount * 0.00015;
        const totalPayable = side === 'sell'
          ? totalAmount - commission - sebonFee - 25
          : totalAmount + commission + sebonFee + 25;
        return { totalAmount, commission, sebonFee, dpCharge: 25, totalPayable, costPerShare: qty > 0 ? totalPayable / qty : 0 };
      };
      return {
        DP_CHARGE: 25,
        calculateTransaction: fallbackCalculateTransaction,
        calculateRoundTrip: ({ buyPrice, soldPrice, qty, holdingDays = 0 }) => {
          const buyTx = fallbackCalculateTransaction('buy', buyPrice, qty);
          const sellTx = fallbackCalculateTransaction('sell', soldPrice, qty);
          const gross = sellTx.totalPayable - buyTx.totalPayable;
          const taxRate = Number(holdingDays || 0) > 365 ? 0.075 : 0.05;
          const tax = gross > 0 ? gross * taxRate : 0;
          return { capitalGainTax: tax, netRealizedAmount: sellTx.totalPayable - tax, capitalGainTaxRate: taxRate };
        },
      };
    }

    function text(id, value) {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    }

    function money(v) {
      return `Rs ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`;
    }

    function fmt(v) {
      return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
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
