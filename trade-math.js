(() => {
  const NEPSE_MIN_COMMISSION = 10;
  const SEBON_RATE = 0.00015;
  const DP_CHARGE = 25;

  function brokerRate(amount) {
    if (amount <= 50000) return 0.0036;
    if (amount <= 500000) return 0.0033;
    if (amount <= 2000000) return 0.0031;
    if (amount <= 10000000) return 0.0027;
    return 0.0024;
  }

  function calculateCommission(amount) {
    return Math.max(NEPSE_MIN_COMMISSION, amount * brokerRate(amount));
  }

  function calculateTransaction(side, unitPrice, qty) {
    const safeQty = Number(qty || 0);
    const safePrice = Number(unitPrice || 0);
    const totalAmount = safePrice * safeQty;
    const commission = calculateCommission(totalAmount);
    const sebonFee = totalAmount * SEBON_RATE;
    const totalPayable = side === 'sell'
      ? totalAmount - commission - sebonFee - DP_CHARGE
      : totalAmount + commission + sebonFee + DP_CHARGE;

    return {
      totalAmount,
      commission,
      sebonFee,
      dpCharge: DP_CHARGE,
      totalPayable,
      costPerShare: safeQty > 0 ? totalPayable / safeQty : 0,
    };
  }

  function calculateRoundTrip({ buyPrice, soldPrice, qty }) {
    const buy = calculateTransaction('buy', buyPrice, qty);
    const sell = calculateTransaction('sell', soldPrice, qty);
    return {
      buy,
      sell,
      invested: buy.totalPayable,
      realizedAmount: sell.totalPayable,
      profit: sell.totalPayable - buy.totalPayable,
    };
  }

  window.PmsTradeMath = {
    NEPSE_MIN_COMMISSION,
    SEBON_RATE,
    DP_CHARGE,
    brokerRate,
    calculateCommission,
    calculateTransaction,
    calculateRoundTrip,
  };
})();
