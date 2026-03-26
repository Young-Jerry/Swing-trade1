(() => {
  const COLORS = ['#4e89ff', '#2ac07e', '#f4b942', '#ff6b6b', '#c084fc', '#22d3ee', '#f97316', '#14b8a6', '#e879f9', '#84cc16'];

  function currency(value) {
    return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
  }

  function normalizeRows(rows = []) {
    const map = new Map();
    rows.forEach((row) => {
      const script = String(row.script || row.name || row.sipName || '').trim().toUpperCase();
      const value = Number(row.value || 0);
      if (!script || !Number.isFinite(value) || value <= 0) return;
      map.set(script, (map.get(script) || 0) + value);
    });
    return [...map.entries()]
      .map(([script, value]) => ({ script, value }))
      .sort((a, b) => b.value - a.value);
  }

  function renderAllocation(targetId, rows = []) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const normalized = normalizeRows(rows);
    if (!normalized.length) {
      target.innerHTML = '<p class="subtitle">No allocation data available.</p>';
      return;
    }

    const total = normalized.reduce((sum, row) => sum + row.value, 0);
    const segments = normalized.map((row, index) => ({
      ...row,
      idx: index,
      share: total > 0 ? (row.value / total) : 0,
      percent: total > 0 ? ((row.value / total) * 100) : 0,
      color: COLORS[index % COLORS.length],
    }));

    let acc = 0;
    segments.forEach((segment) => {
      segment.start = acc;
      acc += segment.share;
      segment.end = acc;
    });

    target.innerHTML = `
      <div class="allocation-layout">
        <div class="allocation-pie" aria-label="Allocation pie chart">
          <svg class="allocation-svg" viewBox="-120 -120 240 240" role="img" aria-label="Allocation pie chart">
            ${segments.map((segment) => piePath(segment)).join('')}
          </svg>
        </div>
        <ul class="legend allocation-legend">
          ${segments.map((segment) => `
            <li>
              <span><span class="dot" style="background:${segment.color}"></span>${segment.script}</span>
              <strong>${segment.percent.toFixed(2)}%</strong>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="allocation-table-wrap">
        <table class="allocation-table">
          <thead>
            <tr><th>Script</th><th>Value</th><th>Allocation</th></tr>
          </thead>
          <tbody>
            ${segments.map((row) => `
              <tr><td>${row.script}</td><td>${currency(row.value)}</td><td>${row.percent.toFixed(2)}%</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function piePath(segment) {
    const startAngle = (segment.start * Math.PI * 2) - Math.PI / 2;
    const endAngle = (segment.end * Math.PI * 2) - Math.PI / 2;
    const radius = 100;

    const x1 = Math.cos(startAngle) * radius;
    const y1 = Math.sin(startAngle) * radius;
    const x2 = Math.cos(endAngle) * radius;
    const y2 = Math.sin(endAngle) * radius;
    const largeArc = segment.end - segment.start > 0.5 ? 1 : 0;

    return `<path d="M 0 0 L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z" fill="${segment.color}"></path>`;
  }

  window.PmsAllocation = {
    renderAllocation,
  };
})();
