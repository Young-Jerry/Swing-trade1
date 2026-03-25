(() => {
  const NEPSE_MIN_COMMISSION = 10;
  const SEBON_RATE = 0.00015;
  const DP_CHARGE = 25;
  const CGT_RATE_INDIVIDUAL = 0.05;

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
    const buy = num(purchasePrice.value);
    const qty = num(shares.value);
    const sell = num(sellingPrice.value);

    sellingWrap.style.display = side === 'sell' ? 'flex' : 'none';

    if (!valid(qty) || !valid(buy) || (side === 'sell' && !valid(sell))) {
      setResults({});
      return;
    }

    if (side === 'buy') {
      const transactionAmount = buy * qty;
      const commission = calculateCommission(transactionAmount);
      const sebonFee = transactionAmount * SEBON_RATE;
      const totalPayable = transactionAmount + commission + sebonFee + DP_CHARGE;
      const costPerShare = totalPayable / qty;

      setResults({
        transactionAmount,
        commission,
        sebonFee,
        tax: 0,
        preTaxTotal: totalPayable,
        finalTotal: totalPayable,
        secondaryLabel: 'Cost Price Per Share (Rs)',
        secondaryValue: costPerShare,
        finalLabel: 'Total Amount Payable (Rs)',
        profit: 0,
      });
      return;
    }

    const sellAmount = sell * qty;
    const buyAmount = buy * qty;

    const sellCommission = calculateCommission(sellAmount);
    const sellSebonFee = sellAmount * SEBON_RATE;
    const buyCommission = calculateCommission(buyAmount);
    const buySebonFee = buyAmount * SEBON_RATE;

    const profitBeforeTax = sellAmount - buyAmount - (sellCommission + sellSebonFee + DP_CHARGE) - (buyCommission + buySebonFee + DP_CHARGE);
    const tax = profitBeforeTax > 0 ? profitBeforeTax * CGT_RATE_INDIVIDUAL : 0;
    const receivableBeforeTax = sellAmount - sellCommission - sellSebonFee - DP_CHARGE;
    const finalReceivable = receivableBeforeTax - tax;

    setResults({
      transactionAmount: sellAmount,
      commission: sellCommission,
      sebonFee: sellSebonFee,
      tax,
      preTaxTotal: receivableBeforeTax,
      finalTotal: finalReceivable,
      secondaryLabel: 'Profit / Loss (Rs)',
      secondaryValue: profitBeforeTax - tax,
      finalLabel: 'Total Amount Receivable (Rs)',
      profit: profitBeforeTax - tax,
    });
  }

  function setResults(result = {}) {
    text('transactionAmount', money(result.transactionAmount || 0));
    text('commission', money(result.commission || 0));
    text('sebonFee', money(result.sebonFee || 0));
    text('dpCharge', money(DP_CHARGE));
    text('totalPayable', money(result.preTaxTotal || 0));
    text('capitalGainTax', money(result.tax || 0));
    text('profitValue', money(result.profit || 0));

    text('finalLabel', result.finalLabel || 'Total Amount Payable (Rs)');
    text('secondaryLabel', result.secondaryLabel || 'Cost Price Per Share (Rs)');
    text('secondaryValue', money(result.secondaryValue || 0));
    text('costPerShare', money(result.finalTotal || 0));
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
})();
