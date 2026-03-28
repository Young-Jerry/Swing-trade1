(() => {
  const EXITED_KEY = 'exitedTradesV2';
  const TRADE_KEYS = ['trades', 'longterm'];
  const MA_WINDOW = 5;

  let chart;
  let currentLimit = 10;

  const nodes = {
    chart: document.getElementById('analyticsChart'),
    noData: document.getElementById('analyticsNoData'),
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
    const labels = rows.map((_, index) => `Trade ${index + 1}`);
    const tradeNumbers = rows.map((_, index) => index + 1);
    const cumulativeProfit = [];
    const investedSeries = [];
    let runningProfit = 0;
    let runningInvested = 0;

    rows.forEach((row) => {
      runningProfit += row.profit;
      runningInvested += row.invested;
      cumulativeProfit.push(round2(runningProfit));
      investedSeries.push(round2(runningInvested));
    });

    const movingAverage = computeMovingAverage(cumulativeProfit, MA_WINDOW);
    const showInvested = Boolean(nodes.toggleInvested && nodes.toggleInvested.checked);
    const showMovingAvg = Boolean(nodes.toggleMovingAvg && nodes.toggleMovingAvg.checked);

    const datasets = [
      {
        label: 'Total Profit',
        data: cumulativeProfit,
        borderColor: '#4f8cff',
        backgroundColor: (ctx) => {
          const { chart: chartRef } = ctx;
          const area = chartRef.chartArea;
          if (!area) return 'rgba(79, 140, 255, 0.25)';
          const gradient = chartRef.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          gradient.addColorStop(0, 'rgba(79, 140, 255, 0.42)');
          gradient.addColorStop(1, 'rgba(79, 140, 255, 0.06)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#d8e6ff',
      },
    ];

    if (showInvested) {
      datasets.push({
        label: 'Invested Amount',
        data: investedSeries,
        borderColor: '#f4b942',
        backgroundColor: 'rgba(244, 185, 66, 0.08)',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      });
    }

    if (showMovingAvg) {
      datasets.push({
        label: `MA (${MA_WINDOW})`,
        data: movingAverage,
        borderColor: '#2ac07e',
        backgroundColor: 'rgba(42, 192, 126, 0.08)',
        borderDash: [7, 5],
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      });
    }

    const config = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
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
                const index = context.dataIndex;
                if (index == null) return '';
                const lines = [];
                const profit = cumulativeProfit[index] ?? 0;
                lines.push(`Profit: ${currency(profit)}`);

                if (showInvested) {
                  const invested = investedSeries[index] ?? 0;
                  lines.push(`Invested: ${currency(invested)}`);
                  lines.push(`Diff: ${signedCurrency(profit - invested)}`);
                }

                if (showMovingAvg) {
                  const maValue = movingAverage[index];
                  if (Number.isFinite(maValue)) {
                    lines.push(`MA: ${currency(maValue)}`);
                    lines.push(`Diff from MA: ${signedCurrency(profit - maValue)}`);
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
            ticks: { color: '#9ba7bf' },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            ticks: {
              color: '#9ba7bf',
              callback(value) {
                return `Rs ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
              },
            },
            grid: { color: 'rgba(255,255,255,0.08)' },
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
