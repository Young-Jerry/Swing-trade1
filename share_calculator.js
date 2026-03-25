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

    const usedPrice = side === 'sell' ? sell : buy;
    const transactionAmount = usedPrice * qty;
    const nepseCommission = calculateCommission(transactionAmount);
    const sebonFee = transactionAmount * SEBON_RATE;

    if (side === 'buy') {
      const totalPayable = transactionAmount + nepseCommission + sebonFee + DP_CHARGE;
      const costPerShare = totalPayable / qty;

      setResults({
        transactionAmount,
        nepseCommission,
        sebonFee,
        dpCharge: DP_CHARGE,
        totalPayable,
        costPerShare,
        finalLabel: 'Total Amount Payable (Rs)',
        finalValue: totalPayable,
        secondaryLabel: 'Cost Price Per Share (Rs)',
        secondaryValue: costPerShare,
        profit: 0,
        tax: 0,
      });
      return;
    }

    const totalReceivable = transactionAmount - nepseCommission - sebonFee - DP_CHARGE;
    const grossProfit = (sell - buy) * qty;
    const netProfitBeforeTax = grossProfit - nepseCommission - sebonFee - DP_CHARGE;
    const tax = netProfitBeforeTax > 0 ? netProfitBeforeTax * CGT_RATE_INDIVIDUAL : 0;
    const finalReceivable = totalReceivable - tax;

    setResults({
      transactionAmount,
      nepseCommission,
      sebonFee,
      dpCharge: DP_CHARGE,
      totalPayable: totalReceivable,
      costPerShare: finalReceivable / qty,
      finalLabel: 'Final Receivable (Rs)',
      finalValue: finalReceivable,
      secondaryLabel: 'Net Profit / Loss (after charges, before tax)',
      secondaryValue: netProfitBeforeTax,
      profit: netProfitBeforeTax,
      tax,
    });
  }

  function setResults(result = {}) {
    const transactionAmount = result.transactionAmount || 0;
    const nepseCommission = result.nepseCommission || 0;
    const sebonFee = result.sebonFee || 0;
    const dpCharge = result.dpCharge ?? DP_CHARGE;
    const totalPayable = result.totalPayable || 0;
    const costPerShare = result.costPerShare || 0;

    text('transactionAmount', money(transactionAmount));
    text('commission', money(nepseCommission));
    text('sebonFee', money(sebonFee));
    text('dpCharge', money(dpCharge));
    text('totalPayable', money(totalPayable));
    text('costPerShare', money(costPerShare));
    text('capitalGainTax', money(result.tax || 0));
    text('profitValue', money(result.profit || 0));

    text('finalLabel', result.finalLabel || 'Total Amount Payable (Rs)');
    text('secondaryLabel', result.secondaryLabel || 'Cost Price Per Share (Rs)');
    text('secondaryValue', money(result.secondaryValue || 0));
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
