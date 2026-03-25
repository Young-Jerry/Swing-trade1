(function () {
  const colors = ['#f4b942', '#2ac07e', '#4e89ff'];
  const keys = [
    { id: 'trades', label: 'Trades', node: 'totalTrades', total: tradeLikeTotal },
    { id: 'longterm', label: 'Long Term', node: 'totalLongTerm', total: tradeLikeTotal },
    { id: 'sipStateV2', label: 'SIP System', node: 'totalMF', total: sipTotal },
  ];

  const totals = keys.map((k) => ({ ...k, value: k.total(k.id) }));
  const combined = totals.reduce((s, x) => s + x.value, 0);

  totals.forEach((t) => {
    document.getElementById(t.node).textContent = currency(t.value);
  });
  document.getElementById('combinedTotal').textContent = currency(combined);

  renderPie(totals, combined);

  function tradeLikeTotal(key) {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return rows.reduce((s, r) => s + (Number(r.ltp || 0) * Number(r.qty || 0)), 0);
  }

  function sipTotal(key) {
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    const records = Object.values(state.records || {});
    return records.flat().reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }

  function renderPie(parts, total) {
    const pie = document.getElementById('allocationPie');
    const legend = document.getElementById('allocationLegend');
    const tooltip = document.getElementById('chartTooltip');
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
      return { color: colors[i], start, end: deg, part: p };
    });
    pie.style.background = `conic-gradient(${segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(',')})`;

    legend.innerHTML = '';
    parts.forEach((p, i) => {
      const li = document.createElement('li');
      const pct = ((p.value / total) * 100).toFixed(1);
      li.innerHTML = `<span><span class="dot" style="background:${colors[i]}"></span>${p.label}</span><strong>${pct}% (${currency(p.value)})</strong>`;
      legend.appendChild(li);
    });

    pie.addEventListener('mousemove', (e) => {
      const rect = pie.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      const normalized = (angle + 450) % 360;
      const hit = segments.find((seg) => normalized >= seg.start && normalized < seg.end);
      if (!hit) return;
      const pct = ((hit.part.value / total) * 100).toFixed(2);
      tooltip.textContent = `${hit.part.label}: ${currency(hit.part.value)} (${pct}%)`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
    });

    pie.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }

  function currency(value) {
    return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;
  }
})();
