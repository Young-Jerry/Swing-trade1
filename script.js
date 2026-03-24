(function () {
  const colors = ['#f4b942', '#2ac07e', '#4e89ff'];
  const keys = [
    { id: 'trades', label: 'Trades', node: 'totalTrades' },
    { id: 'longterm', label: 'Long Term', node: 'totalLongTerm' },
    { id: 'mf', label: 'Mutual Funds', node: 'totalMF' },
  ];

  const totals = keys.map((k) => ({ ...k, value: portfolioTotal(k.id) }));
  const combined = totals.reduce((s, x) => s + x.value, 0);

  totals.forEach((t) => {
    document.getElementById(t.node).textContent = currency(t.value);
  });
  document.getElementById('combinedTotal').textContent = currency(combined);

  renderPie(totals, combined);

  function portfolioTotal(key) {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return rows.reduce((s, r) => s + (Number(r.ltp || 0) * Number(r.qty || 0)), 0);
  }

  function renderPie(parts, total) {
    const pie = document.getElementById('allocationPie');
    const legend = document.getElementById('allocationLegend');
    if (!total) {
      pie.style.background = '#1b2332';
      legend.innerHTML = '<li>No holdings available.</li>';
      return;
    }

    let deg = 0;
    const segments = parts.map((p, i) => {
      const share = (p.value / total) * 360;
      const start = deg;
      deg += share;
      return `${colors[i]} ${start}deg ${deg}deg`;
    });
    pie.style.background = `conic-gradient(${segments.join(',')})`;

    legend.innerHTML = '';
    parts.forEach((p, i) => {
      const li = document.createElement('li');
      const pct = ((p.value / total) * 100).toFixed(1);
      li.innerHTML = `<span><span class="dot" style="background:${colors[i]}"></span>${p.label}</span><strong>${pct}% (${currency(p.value)})</strong>`;
      legend.appendChild(li);
    });
  }

  function currency(value) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;
  }
})();
