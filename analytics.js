(() => {
  const EXITED_KEY = 'exitedTradesV2';
  const TRADE_KEYS = ['trades', 'longterm'];
  const MA_WINDOW = 5;

  let chart;
  let currentLimit = 10;

  const nodes = {
    chart: document.getElementById('analyticsChart'),
    noData: document.getElementById('analyticsNoData'),
    togglePerTrade: document.getElementById('togglePerTrade'),
    toggleInvested: document.getElementById('toggleInvested'),
    toggleMovingAvg: document.getElementById('toggleMovingAvg'),
    resetZoomBtn: document.getElementById('resetZoomBtn'),
    filterButtons: Array.from(document.querySelectorAll('.analytics-filter-btn')),
    totalProfit: document.getElementById('kpiTotalProfit'),
    totalInvested: document.getElementById('kpiTotalInvested'),
    roi: document.getElementById('kpiRoi'),
    summaryTotal: document.getElementById('summaryTotalTrades'),
    summaryWins: document.getElementById('summaryWinTrades'),
    summaryLosses: document.getElementById('summaryLossTrades'),
  };

  if (!nodes.chart) return;

  bindEvents();
  renderAnalytics();

  function bindEvents() {
    nodes.filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const { tradeLimit } = button.dataset;
        currentLimit = tradeLimit === 'ALL' ? 'ALL' : Number(tradeLimit);
        nodes.filterButtons.forEach((item) => item.classList.toggle('active', item === button));
        renderAnalytics();
      });
    });

    if (nodes.togglePerTrade) nodes.togglePerTrade.addEventListener('change', renderAnalytics);
    if (nodes.toggleInvested) nodes.toggleInvested.addEventListener('change', renderAnalytics);
    if (nodes.toggleMovingAvg) nodes.toggleMovingAvg.addEventListener('change', renderAnalytics);
    if (nodes.resetZoomBtn) {
      nodes.resetZoomBtn.addEventListener('click', () => {
        if (chart) chart.resetZoom();
      });
    }

    window.addEventListener('storage', renderAnalytics);
    window.addEventListener('focus', renderAnalytics);
  }

  function renderAnalytics() {
    const exited = safeJson(localStorage.getItem(EXITED_KEY), []).map(normalizeExited);
    const filtered = applyLimit(exited, currentLimit);

    updateKpis(filtered);
    updateSummary(filtered);

    if (!filtered.length) {
      teardownChart();
      if (nodes.noData) nodes.noData.hidden = false;
      return;
    }

    if (nodes.noData) nodes.noData.hidden = true;
    drawChart(filtered);
  }

  function drawChart(rows) {
    const tradeNumbers = rows.map((_, index) => index + 1);
    const perTradeProfit = rows.map((row) => round2(row.profit));
    const equityCurve = computeCumulativeSeries(perTradeProfit);
    const investedSeries = computeCumulativeSeries(rows.map((row) => round2(row.invested)));
    const isPerTradeMode = Boolean(nodes.togglePerTrade && nodes.togglePerTrade.checked);
    const primarySeries = isPerTradeMode ? perTradeProfit : equityCurve;
    const primaryLabel = isPerTradeMode ? 'Per Trade Profit' : 'Equity Curve';
    const movingAverage = computeMovingAverage(primarySeries, MA_WINDOW);
    const labels = equityCurve.map((_, index) => index + 1);
    const showInvested = Boolean(nodes.toggleInvested && nodes.toggleInvested.checked);
    const showMovingAvg = Boolean(nodes.toggleMovingAvg && nodes.toggleMovingAvg.checked);

    const datasets = [
      {
        label: primaryLabel,
        data: primarySeries,
        borderColor: '#22c55e',
        backgroundColor: (ctx) => {
          const { chart: chartRef } = ctx;
          const area = chartRef.chartArea;
          if (!area) return 'rgba(34, 197, 94, 0.20)';
          const gradient = chartRef.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          gradient.addColorStop(0, 'rgba(34, 197, 94, 0.35)');
          gradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
          return gradient;
        },
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 10,
        pointBackgroundColor: '#d8e6ff',
      },
    ];

    if (showInvested) {
      datasets.push({
        label: 'Invested Amount',
        data: investedSeries,
        borderColor: 'rgba(244, 185, 66, 0.65)',
        backgroundColor: 'rgba(244, 185, 66, 0.08)',
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 10,
      });
    }

    if (showMovingAvg) {
      datasets.push({
        label: `MA (${MA_WINDOW})`,
        data: movingAverage,
        borderColor: 'rgba(42, 192, 126, 0.60)',
        backgroundColor: 'rgba(42, 192, 126, 0.08)',
        borderDash: [7, 5],
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 10,
      });
    }

    const config = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: {
          duration: 800,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            labels: {
              color: '#e8edf7',
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              title(items) {
                const item = items[0];
                if (!item) return '';
                return `Trade ${tradeNumbers[item.dataIndex]}`;
              },
              label(context) {
                if (context.datasetIndex !== 0) return null;
                const index = context.dataIndex;
                if (index == null) return '';
                const lines = [];
                const equityValue = primarySeries[index] ?? 0;
                lines.push(`Equity: ${currency(equityValue)}`);

                if (showInvested) {
                  const invested = investedSeries[index] ?? 0;
                  lines.push(`Invested: ${currency(invested)}`);
                  lines.push(`Diff: ${signedCurrency(equityValue - invested)}`);
                }

                if (showMovingAvg) {
                  const maValue = movingAverage[index];
                  if (Number.isFinite(maValue)) {
                    lines.push(`MA: ${currency(maValue)}`);
                    lines.push(`Diff: ${signedCurrency(equityValue - maValue)}`);
                  }
                }

                return lines;
              },
            },
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'xy',
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#9ba7bf',
              maxTicksLimit: 8,
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            ticks: {
              color: '#9ba7bf',
              callback(value) {
                return `Rs ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
              },
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    };

    teardownChart();
    chart = new Chart(nodes.chart, config);
  }

  function updateKpis(rows) {
    const totals = rows.reduce((acc, row) => {
      acc.profit += row.profit;
      acc.invested += row.invested;
      return acc;
    }, { profit: 0, invested: 0 });

    if (!totals.invested) {
      totals.invested = TRADE_KEYS
        .map((key) => safeJson(localStorage.getItem(key), []))
        .flat()
        .reduce((sum, row) => sum + (Number(row.wacc || 0) * Number(row.qty || 0)), 0);
    }

    const roi = totals.invested > 0 ? ((totals.profit / totals.invested) * 100) : 0;

    if (nodes.totalProfit) {
      nodes.totalProfit.textContent = currency(totals.profit);
      nodes.totalProfit.className = `stat-value ${totals.profit >= 0 ? 'value-profit' : 'value-loss'}`;
    }
    if (nodes.totalInvested) nodes.totalInvested.textContent = currency(totals.invested);
    if (nodes.roi) {
      nodes.roi.textContent = `${roi.toFixed(2)}%`;
      nodes.roi.className = `stat-value ${roi >= 0 ? 'value-profit' : 'value-loss'}`;
    }
  }

  function updateSummary(rows) {
    const wins = rows.filter((row) => row.profit > 0).length;
    const losses = rows.filter((row) => row.profit < 0).length;

    if (nodes.summaryTotal) nodes.summaryTotal.textContent = String(rows.length);
    if (nodes.summaryWins) nodes.summaryWins.textContent = String(wins);
    if (nodes.summaryLosses) nodes.summaryLosses.textContent = String(losses);
  }

  function normalizeExited(row) {
    const realized = Number(row.netSoldTotal || row.soldTotal || row.total || 0);
    const invested = Number(row.buyTotal || (Number(row.buyPrice || 0) * Number(row.qty || 0)) || 0);
    const profit = Number(row.profit || row.netProfit || 0);
    return {
      ...row,
      realized,
      invested,
      profit,
    };
  }

  function applyLimit(rows, limit) {
    if (limit === 'ALL') return rows;
    const parsed = Number(limit || 0);
    if (!parsed || parsed < 0) return rows;
    return rows.slice(-parsed);
  }

  function computeMovingAverage(series, windowSize) {
    return series.map((_, index) => {
      if (index < windowSize - 1) return null;
      const start = index - windowSize + 1;
      const set = series.slice(start, index + 1);
      const avg = set.reduce((sum, value) => sum + value, 0) / set.length;
      return round2(avg);
    });
  }

  function computeCumulativeSeries(series) {
    let runningTotal = 0;
    return series.map((value) => {
      runningTotal += Number(value || 0);
      return round2(runningTotal);
    });
  }

  function safeJson(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function round2(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function currency(value) {
    return `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function signedCurrency(value) {
    const n = Number(value || 0);
    const sign = n >= 0 ? '+' : '-';
    return `${sign}${currency(Math.abs(n)).replace('Rs ', 'Rs ')}`;
  }

  function teardownChart() {
    if (!chart) return;
    chart.destroy();
    chart = null;
  }
})();
