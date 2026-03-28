(() => {
  const EXITED_KEY = 'exitedTradesV2';
  const MA_DEFAULT = 5;

  let chart;
  let currentLimit = 'ALL';

  const nodes = {
    chart: document.getElementById('analyticsChart'),
    noData: document.getElementById('analyticsNoData'),
    resetZoomBtn: document.getElementById('resetZoomBtn'),
    filterButtons: Array.from(document.querySelectorAll('.analytics-filter-btn')),
    togglePerTrade: document.getElementById('togglePerTrade'),
    toggleInvested: document.getElementById('toggleInvested'),
    toggleMovingAvg: document.getElementById('toggleMovingAvg'),
    movingAvgWindow: document.getElementById('movingAvgWindow'),
  };

  if (!nodes.chart) return;

  bindEvents();
  renderAnalytics();

  function bindEvents() {
    nodes.filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const { tradeLimit } = button.dataset;
        currentLimit = tradeLimit === 'ALL' ? 'ALL' : Number(tradeLimit || 0);
        nodes.filterButtons.forEach((item) => item.classList.toggle('active', item === button));
        renderAnalytics();
      });
    });

    [nodes.togglePerTrade, nodes.toggleInvested, nodes.toggleMovingAvg, nodes.movingAvgWindow]
      .filter(Boolean)
      .forEach((el) => el.addEventListener('change', renderAnalytics));

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

    if (!filtered.length) {
      teardownChart();
      if (nodes.noData) nodes.noData.hidden = false;
      return;
    }

    if (nodes.noData) nodes.noData.hidden = true;
    drawChart(filtered);
  }

  function drawChart(rows) {
    const labels = [0];
    const profits = [0];
    const invested = [0];

    rows.forEach((row, index) => {
      labels.push(index + 1);
      profits.push(round2(row.profit));
      invested.push(round2(row.invested));
    });

    const equityCurve = computeCumulativeSeries(profits);
    const investedCurve = computeCumulativeSeries(invested);
    const usePerTrade = Boolean(nodes.togglePerTrade && nodes.togglePerTrade.checked);
    const showInvested = Boolean(nodes.toggleInvested && nodes.toggleInvested.checked);
    const showMa = Boolean(nodes.toggleMovingAvg && nodes.toggleMovingAvg.checked);
    const maWindow = Number(nodes.movingAvgWindow?.value || MA_DEFAULT);
    const primarySeries = usePerTrade ? profits : equityCurve;
    const movingAvg = computeMovingAverage(primarySeries, maWindow);

    const datasets = [
      {
        label: usePerTrade ? 'Per Trade Profit' : 'Profit Curve',
        data: primarySeries,
        segment: {
          borderColor: (ctx) => ((ctx.p0.parsed.y < 0 || ctx.p1.parsed.y < 0) ? '#ea5a5a' : '#2ac07e'),
          backgroundColor: (ctx) => ((ctx.p0.parsed.y < 0 || ctx.p1.parsed.y < 0) ? 'rgba(234,90,90,.16)' : 'rgba(42,192,126,.16)'),
        },
        borderColor: '#2ac07e',
        borderWidth: 2.5,
        fill: false,
        tension: 0.28,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: (ctx) => (ctx.raw >= 0 ? '#2ac07e' : '#ea5a5a'),
      },
    ];

    if (showInvested) {
      datasets.push({
        label: 'Invested Amount',
        data: investedCurve,
        borderColor: 'rgba(244,185,66,.8)',
        borderWidth: 1.8,
        fill: false,
        tension: 0.2,
        pointRadius: 0,
      });
    }

    if (showMa) {
      datasets.push({
        label: `MA (${maWindow})`,
        data: movingAvg,
        borderColor: 'rgba(115,165,255,.9)',
        borderWidth: 1.6,
        fill: false,
        borderDash: [6, 5],
        pointRadius: 0,
        tension: 0.2,
      });
    }

    teardownChart();
    chart = new Chart(nodes.chart, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          zoom: {
            pan: { enabled: true, mode: 'xy', modifierKey: null },
            limits: { x: { min: 0 }, y: { min: 'original', max: 'original' } },
            zoom: {
              wheel: { enabled: true },
              drag: { enabled: true },
              pinch: { enabled: true },
              mode: 'xy',
            },
          },
        },
        scales: {
          x: {
            min: 0,
            ticks: { color: '#9ba7bf' },
            grid: { color: 'rgba(255,255,255,.05)' },
          },
          y: {
            ticks: {
              color: '#9ba7bf',
              callback(value) {
                return `Rs ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
              },
            },
            grid: { color: 'rgba(255,255,255,.05)' },
          },
        },
      },
    });
  }

  function applyLimit(rows, limit) {
    if (limit === 'ALL') return rows;
    const parsed = Number(limit || 0);
    if (!parsed || parsed < 0) return rows;
    return rows.slice(-parsed);
  }

  function normalizeExited(row) {
    return {
      profit: Number(row.profit || row.netProfit || 0),
      invested: Number(row.buyTotal || (Number(row.buyPrice || 0) * Number(row.qty || 0)) || 0),
    };
  }

  function computeCumulativeSeries(series) {
    let running = 0;
    return series.map((value) => {
      running += Number(value || 0);
      return round2(running);
    });
  }

  function computeMovingAverage(series, windowSize) {
    return series.map((_, idx) => {
      if (idx === 0) return 0;
      if (idx < windowSize - 1) return null;
      const set = series.slice(idx - windowSize + 1, idx + 1);
      return round2(set.reduce((sum, n) => sum + Number(n || 0), 0) / set.length);
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

  function teardownChart() {
    if (!chart) return;
    chart.destroy();
    chart = null;
  }
})();
