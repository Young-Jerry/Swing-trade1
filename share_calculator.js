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
    const buyIsWacc = document.getElementById('buyIsWacc');
    const sellUsesWaccBuy = document.getElementById('sellUsesWaccBuy');
    const capitalGainRow = document.getElementById('capitalGainRow');
    const receivableRow = document.getElementById('receivableRow');

    [action, purchasePrice, shares, sellingPrice, buyIsWacc, sellUsesWaccBuy].forEach((el) => {
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
      document.getElementById('sellWaccWrap').style.display = side === 'sell' ? 'flex' : 'none';
      capitalGainRow.style.display = side === 'sell' ? 'flex' : 'none';
      receivableRow.style.display = side === 'sell' ? 'flex' : 'none';

      if (!valid(qty) || !valid(buy) || (side === 'sell' && !valid(sell))) {
        setResults({ totalAmount: 0, commission: 0, sebonFee: 0, totalPayable: 0, costPerShare: 0 }, 0, 0);
        return;
      }

      const unitPrice = side === 'buy' ? buy : sell;
      const tx = math().calculateTransaction(side, unitPrice, qty, { buyIsWacc: buyIsWacc.checked && side === 'buy' });
      const buyTx = math().calculateTransaction('buy', buy, qty, { buyIsWacc: buyIsWacc.checked || sellUsesWaccBuy.checked });
      const grossProfit = side === 'sell' ? tx.totalPayable - buyTx.totalPayable : 0;
      const capitalGain = side === 'sell' && grossProfit > 0 ? grossProfit * 0.05 : 0;
      const totalReceivable = side === 'sell' ? tx.totalPayable - capitalGain : 0;

      setResults(tx, capitalGain, totalReceivable);
    }

    function setResults(tx, capitalGain, totalReceivable) {
      text('transactionAmount', money(tx.totalAmount));
      text('commission', money(tx.commission));
      text('sebonFee', money(tx.sebonFee));
      text('dpCharge', money(math().DP_CHARGE));
      text('totalPayable', money(tx.totalPayable));
      text('costPerShare', money(tx.costPerShare));
      text('capitalGain', money(capitalGain));
      text('totalReceivable', money(totalReceivable));
      text('commissionNote', `* Commission Amount includes NEPSE Commission Rs ${fmt(tx.commission)} & SEBON Regularity Fee Rs ${fmt(tx.sebonFee)}.`);
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
