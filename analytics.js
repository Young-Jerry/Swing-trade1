(() => {
  const EXITED_KEY = 'exitedTradesV2';
  const MA_DEFAULT = 5;

  let chart;

  const nodes = {
    chart: document.getElementById('analyticsChart'),
    noData: document.getElementById('analyticsNoData'),
    resetZoomBtn: document.getElementById('resetZoomBtn'),
    togglePerTrade: document.getElementById('togglePerTrade'),
    toggleInvested: document.getElementById('toggleInvested'),
    toggleMovingAvg: document.getElementById('toggleMovingAvg'),
    movingAvgWindow: document.getElementById('movingAvgWindow'),
    totalInvested: document.getElementById('analyticsTotalInvested'),
    totalProfit: document.getElementById('analyticsTotalProfit'),
    roi: document.getElementById('analyticsRoi'),
    totalTrades: document.getElementById('analyticsTotalTrades'),
  };

  if (!nodes.chart) return;

  bindEvents();
  renderAnalytics();

  function bindEvents() {
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
    updateSummary(exited);

    if (!exited.length) {
      teardownChart();
      if (nodes.noData) nodes.noData.hidden = false;
      return;
    }

    if (nodes.noData) nodes.noData.hidden = true;
    drawChart(exited);
  }

  function updateSummary(rows) {
    const totals = rows.reduce((acc, row) => {
      acc.invested += Number(row.invested || 0);
      acc.profit += Number(row.profit || 0);
      return acc;
    }, { invested: 0, profit: 0 });

    const roi = totals.invested > 0 ? (totals.profit / totals.invested) * 100 : 0;

    if (nodes.totalInvested) nodes.totalInvested.textContent = money(totals.invested);
    if (nodes.totalProfit) nodes.totalProfit.textContent = money(totals.profit);
    if (nodes.roi) nodes.roi.textContent = `${round2(roi)}%`;
    if (nodes.totalTrades) nodes.totalTrades.textContent = String(rows.length);
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

    const zeroCrossings = computeZeroCrossings(primarySeries);

    const datasets = [
      {
        label: usePerTrade ? 'Per Trade Profit' : 'Profit Curve',
        data: primarySeries,
        segment: {
          borderColor: (ctx) => {
            const y0 = Number(ctx.p0.parsed.y || 0);
            const y1 = Number(ctx.p1.parsed.y || 0);
            return (y0 < 0 || y1 < 0) ? '#ff5f5f' : '#3ed8a4';
          },
        },
        borderColor: '#3ed8a4',
        borderWidth: 3,
        fill: false,
        tension: 0.22,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 10,
      },
    ];

    if (showInvested) {
      datasets.push({
        label: 'Invested Amount',
        data: investedCurve,
        borderColor: '#69d2ff',
        borderWidth: 2,
        fill: false,
        tension: 0.16,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 10,
      });
    }


    if (zeroCrossings.length) {
      datasets.push({
        label: 'Zero Intersections',
        data: zeroCrossings,
        parsing: false,
        showLine: false,
        pointRadius: 3.5,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#ffffff',
      });
    }
    if (showMa) {
      datasets.push({
        label: `MA (${maWindow})`,
        data: movingAvg,
        borderColor: '#8bb8ff',
        borderWidth: 1.8,
        fill: false,
        borderDash: [7, 6],
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
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
        interaction: { mode: 'nearest', intersect: true, axis: 'xy' },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            mode: 'nearest',
            intersect: true,
            displayColors: false,
            callbacks: {
              title(items) {
                return `Trade ${items[0]?.label ?? ''}`;
              },
              label(context) {
                return `${context.dataset.label}: ${money(context.parsed.y)}`;
              },
            },
          },
          zoom: {
            pan: { enabled: false },
            limits: {
              x: { min: 0, max: labels.length - 1, minRange: 1 },
            },
            zoom: {
              wheel: { enabled: true },
              drag: { enabled: false },
              pinch: { enabled: true },
              mode: 'x',
              onZoomComplete: ({ chart: activeChart }) => {
                const scale = activeChart.scales.x;
                const min = Math.max(0, Math.floor(scale.min));
                const max = Math.min(labels.length - 1, Math.ceil(scale.max));
                if (max - min < 1) {
                  activeChart.zoomScale('x', { min, max: min + 1 }, 'none');
                } else {
                  activeChart.zoomScale('x', { min, max }, 'none');
                }
              },
            },
          },
        },
        scales: {
          x: {
            min: 0,
            max: labels.length - 1,
            ticks: {
              color: '#b5d8ea',
              callback(value) {
                return Number.isInteger(value) ? value : '';
              },
            },
            grid: { color: 'rgba(255,255,255,.06)' },
          },
          y: {
            ticks: {
              color: '#b5d8ea',
              callback(value) {
                return money(value);
              },
            },
            border: { color: '#7bcfff' },
            grid: {
              color(ctx) {
                return ctx.tick?.value === 0 ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.07)';
              },
              lineWidth(ctx) {
                return ctx.tick?.value === 0 ? 2.8 : 1;
              },
            },
          },
        },
      },
    });
  }


  function computeZeroCrossings(series) {
    const points = [];
    for (let i = 1; i < series.length; i += 1) {
      const prev = Number(series[i - 1] || 0);
      const curr = Number(series[i] || 0);
      if (prev === 0) points.push({ x: i - 1, y: 0 });
      const crossed = (prev < 0 && curr > 0) || (prev > 0 && curr < 0);
      if (crossed) {
        const t = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
        points.push({ x: round2((i - 1) + t), y: 0 });
      }
      if (curr === 0) points.push({ x: i, y: 0 });
    }
    return points;
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

  function money(value) {
    return `Rs ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  function teardownChart() {
    if (!chart) return;
    chart.destroy();
    chart = null;
  }
})();
