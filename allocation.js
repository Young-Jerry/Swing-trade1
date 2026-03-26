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
    const tooltip = ensureTooltip();

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
    `;

    const pie = target.querySelector('.allocation-pie');
    const paths = [...target.querySelectorAll('path[data-idx]')];
    const legendRows = [...target.querySelectorAll('.allocation-legend li')];
    if (!pie) return;

    const activateSegment = (idx) => {
      paths.forEach((path) => {
        const active = Number(path.dataset.idx) === idx;
        path.classList.toggle('active', active);
        path.classList.toggle('inactive', !active);
      });
      legendRows.forEach((item) => {
        item.classList.toggle('active', Number(item.dataset.idx) === idx);
      });
      const hit = segments[idx];
      if (hit) pie.style.setProperty('--pie-glow', hit.color);
    };

    const clearActive = () => {
      paths.forEach((path) => path.classList.remove('active', 'inactive'));
      legendRows.forEach((item) => item.classList.remove('active'));
      pie.style.setProperty('--pie-glow', COLORS[0]);
      pie.style.setProperty('--tilt-x', '0deg');
      pie.style.setProperty('--tilt-y', '0deg');
      if (tooltip) tooltip.style.display = 'none';
    };

    pie.onmousemove = (event) => {
      const rect = pie.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = event.clientX - centerX;
      const deltaY = event.clientY - centerY;
      const angleRad = Math.atan2(deltaY, deltaX);
      const distance = Math.sqrt((deltaX ** 2) + (deltaY ** 2));
      const normalized = ((angleRad * 180) / Math.PI + 450) % 360;
      const inside = distance <= rect.width / 2;
      const hit = inside
        ? segments.find((segment) => normalized >= segment.start * 360 && normalized < segment.end * 360)
        : null;

      pie.style.setProperty('--tilt-x', `${Math.max(-8, Math.min(8, -deltaY / 16))}deg`);
      pie.style.setProperty('--tilt-y', `${Math.max(-8, Math.min(8, deltaX / 16))}deg`);

      if (!hit) {
        clearActive();
        return;
      }

      activateSegment(hit.idx);
      if (tooltip) {
        tooltip.textContent = `${hit.script}: ${currency(hit.value)} (${hit.percent.toFixed(2)}%)`;
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
      }
    };

    pie.onmouseleave = clearActive;
    legendRows.forEach((item) => {
      item.addEventListener('mouseenter', (event) => {
        const idx = Number(item.dataset.idx);
        activateSegment(idx);
        const hit = segments[idx];
        if (hit && tooltip) {
          tooltip.textContent = `${hit.script}: ${currency(hit.value)} (${hit.percent.toFixed(2)}%)`;
          tooltip.style.display = 'block';
          tooltip.style.left = `${event.pageX + 10}px`;
          tooltip.style.top = `${event.pageY + 10}px`;
        }
      });
      item.addEventListener('mousemove', (event) => {
        if (!tooltip || tooltip.style.display !== 'block') return;
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
      });
      item.addEventListener('mouseleave', clearActive);
    });
  }

  function piePath(segment) {
    if (segment.end - segment.start >= 0.9999) {
      return `<circle data-idx="${segment.idx}" cx="0" cy="0" r="100" fill="${segment.color}"></circle>`;
    }
    const startAngle = (segment.start * Math.PI * 2) - Math.PI / 2;
    const endAngle = (segment.end * Math.PI * 2) - Math.PI / 2;
    const radius = 100;

    const x1 = Math.cos(startAngle) * radius;
    const y1 = Math.sin(startAngle) * radius;
    const x2 = Math.cos(endAngle) * radius;
    const y2 = Math.sin(endAngle) * radius;
    const largeArc = segment.end - segment.start > 0.5 ? 1 : 0;

    return `<path data-idx="${segment.idx}" d="M 0 0 L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z" fill="${segment.color}"></path>`;
  }

  function ensureTooltip() {
    let tooltip = document.getElementById('chartTooltip');
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.id = 'chartTooltip';
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  window.PmsAllocation = {
    renderAllocation,
  };
})();
