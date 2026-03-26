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

  function calculateTransaction(side, unitPrice, qty, options = {}) {
    const safeQty = Number(qty || 0);
    const safePrice = Number(unitPrice || 0);
    const totalAmount = safePrice * safeQty;
    const treatBuyAsWacc = side === 'buy' && Boolean(options.buyIsWacc);

    const commission = treatBuyAsWacc ? 0 : calculateCommission(totalAmount);
    const sebonFee = treatBuyAsWacc ? 0 : totalAmount * SEBON_RATE;
    const dpCharge = treatBuyAsWacc ? 0 : DP_CHARGE;

    const totalPayable = side === 'sell'
      ? totalAmount - commission - sebonFee - dpCharge
      : totalAmount + commission + sebonFee + dpCharge;

    return {
      totalAmount,
      commission,
      sebonFee,
      dpCharge,
      totalPayable,
      costPerShare: safeQty > 0 ? totalPayable / safeQty : 0,
    };
  }

  function calculateRoundTrip({ buyPrice, soldPrice, qty, buyIsWacc = true }) {
    const buy = calculateTransaction('buy', buyPrice, qty, { buyIsWacc });
    const sell = calculateTransaction('sell', soldPrice, qty);
    const grossProfit = sell.totalPayable - buy.totalPayable;
    const capitalGainTax = grossProfit > 0 ? grossProfit * 0.05 : 0;
    const netProfit = grossProfit - capitalGainTax;
    return {
      buy,
      sell,
      invested: buy.totalPayable,
      realizedAmount: sell.totalPayable,
      netRealizedAmount: sell.totalPayable - capitalGainTax,
      grossProfit,
      capitalGainTax,
      profit: netProfit,
      netProfit,
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
