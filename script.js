(() => {
  const COLORS = ['#f4b942', '#2ac07e', '#4e89ff'];
  const DATA_KEYS = [
    { id: 'trades', label: 'Trades', node: 'totalTrades', total: tradeLikeTotal },
    { id: 'longterm', label: 'Long Term', node: 'totalLongTerm', total: tradeLikeTotal },
    { id: 'sipStateV4', label: 'SIP', node: 'totalSip', total: sipTotal },
  ];

  let initialized = false;

  const boot = () => {
    if (initialized) return;
    initialized = true;
    bindBackupControls();
    bindRealtimeRefresh();
    renderDashboard();
  };

  function bindRealtimeRefresh() {
    window.addEventListener('storage', renderDashboard);
    window.addEventListener('focus', renderDashboard);
    window.addEventListener('pms-ltp-updated', renderDashboard);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) renderDashboard();
    });
  }

  function renderDashboard() {
    const totals = DATA_KEYS.map((key) => ({ ...key, value: key.total(key.id) }));
    const combined = totals.reduce((sum, row) => sum + row.value, 0);

    totals.forEach((entry) => {
      const node = document.getElementById(entry.node);
      if (node) node.textContent = currency(entry.value);
    });

    const combinedNode = document.getElementById('combinedTotal');
    if (combinedNode) combinedNode.textContent = currency(combined);

    renderPie(totals, combined);


    if (window.PmsCapital && typeof window.PmsCapital.updateWidgets === 'function') {
      window.PmsCapital.updateWidgets();
    }
  }

  function bindBackupControls() {
    const downloadBtn = document.getElementById('downloadPortfolioBtn');
    const uploadInput = document.getElementById('uploadPortfolioInput');
    const statusNode = document.getElementById('backupStatus');
    if (!downloadBtn || !uploadInput || !statusNode) return;

    downloadBtn.addEventListener('click', () => {
      try {
        const snapshot = createPortfolioSnapshot();
        const json = JSON.stringify(snapshot, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `NP ${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        statusNode.textContent = 'Backup file downloaded ✓';
      } catch (error) {
        statusNode.textContent = 'Backup failed. Try again.';
        console.error('Portfolio backup download failed:', error);
      }
    });

    uploadInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        restorePortfolioSnapshot(payload);
        statusNode.textContent = 'Backup restored ✓ Reloading...';
        setTimeout(() => location.reload(), 400);
      } catch (error) {
        statusNode.textContent = 'Invalid backup file.';
        console.error('Portfolio backup upload failed:', error);
      } finally {
        uploadInput.value = '';
      }
    });
  }

  function createPortfolioSnapshot() {
    const data = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      data[key] = localStorage.getItem(key);
    }

    return {
      format: 'pms-local-backup-v1',
      exportedAt: new Date().toISOString(),
      data,
    };
  }

  function restorePortfolioSnapshot(payload) {
    const backup = payload && typeof payload === 'object' ? payload : null;
    if (!backup) throw new Error('Unexpected backup format');

    const data = backup.format === 'pms-local-backup-v1' ? backup.data : backup;
    if (!data || typeof data !== 'object') throw new Error('Unexpected backup format');

    const entries = Object.entries(data)
      .filter(([key, value]) => typeof key === 'string' && typeof value === 'string');

    if (!entries.length) throw new Error('No restorable data in file');

    localStorage.clear();
    entries.forEach(([key, value]) => localStorage.setItem(key, value));
  }

  function tradeLikeTotal(key) {
    const rows = safeJson(localStorage.getItem(key), []);
    return rows.reduce((sum, row) => sum + Number(row.ltp || 0) * Number(row.qty || 0), 0);
  }

  function sipTotal() {
    const state = safeJson(
      localStorage.getItem('sipStateV4')
      || localStorage.getItem('sipStateV3')
      || localStorage.getItem('sipStateV2')
      || '{}',
      {},
    );

    const currentNav = state.currentNav || {};
    const records = Object.entries(state.records || {});
    return records.reduce((sum, [sipName, list]) => {
      const rows = Array.isArray(list) ? list : [];
      const units = rows.reduce((u, row) => u + Number(row.units || 0), 0);
      const lastNav = Number(rows[rows.length - 1]?.nav || 0);
      const nav = Number(currentNav[sipName] || lastNav || 0);
      if (nav > 0 && units > 0) return sum + units * nav;
      return sum + rows.reduce((s, row) => s + Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0))), 0);
    }, 0);
  }


  function rowsFromKey(key) {
    const rows = safeJson(localStorage.getItem(key), []);
    return rows.map((row) => ({ script: row.script, value: Number(row.ltp || 0) * Number(row.qty || 0) }));
  }

  function rowsFromSip() {
    const state = safeJson(localStorage.getItem('sipStateV4') || '{}', {});
    return Object.entries(state.records || {}).map(([sipName, list]) => {
      const rows = Array.isArray(list) ? list : [];
      const units = rows.reduce((sum, row) => sum + Number(row.units || 0), 0);
      const nav = Number((state.currentNav || {})[sipName] || rows[rows.length - 1]?.nav || 0);
      return { script: sipName, value: units * nav };
    });
  }

  function renderPie(parts, total) {
    const pie = document.getElementById('allocationPie');
    const legend = document.getElementById('allocationLegend');
    const tooltip = document.getElementById('chartTooltip');
    if (!pie || !legend) return;

    if (!total) {
      pie.innerHTML = '<div class="pie-empty">No data</div>';
      legend.innerHTML = '<li>No holdings available.</li>';
      return;
    }

    let cumulative = 0;
    const segments = parts.map((part, index) => {
      const share = part.value / total;
      const start = cumulative;
      cumulative += share;
      return {
        color: COLORS[index],
        start,
        end: cumulative,
        part,
        idx: index,
      };
    });

    pie.innerHTML = `
      <svg class="allocation-svg" viewBox="-120 -120 240 240" role="img" aria-label="Allocation pie chart">
        ${segments.map((segment) => piePath(segment)).join('')}
      </svg>
    `;

    const paths = [...pie.querySelectorAll('path[data-idx]')];
    const summaryCards = [...document.querySelectorAll('.stat-card[data-summary-card]')];
    legend.innerHTML = '';

    parts.forEach((part, index) => {
      const listItem = document.createElement('li');
      listItem.dataset.idx = String(index);
      const pct = ((part.value / total) * 100).toFixed(1);
      listItem.innerHTML = `<span><span class="dot" style="background:${COLORS[index]}"></span>${part.label}</span><strong>${pct}% (${currency(part.value)})</strong>`;
      legend.appendChild(listItem);
    });

    const activateSegment = (idx) => {
      paths.forEach((path) => {
        const active = Number(path.dataset.idx) === idx;
        path.classList.toggle('active', active);
        path.classList.toggle('inactive', !active);
      });
      legend.querySelectorAll('li').forEach((item) => {
        item.classList.toggle('active', Number(item.dataset.idx) === idx);
      });
      summaryCards.forEach((card) => {
        card.classList.toggle('linked-hover', card.dataset.summaryCard === segments[idx]?.part?.label);
      });
      const hit = segments[idx];
      if (hit) pie.style.setProperty('--pie-glow', hit.color);
    };

    const clearActive = () => {
      paths.forEach((path) => path.classList.remove('active', 'inactive'));
      legend.querySelectorAll('li').forEach((item) => item.classList.remove('active'));
      summaryCards.forEach((card) => card.classList.remove('linked-hover'));
      pie.style.setProperty('--pie-glow', COLORS[0]);
      pie.style.setProperty('--tilt-x', '0deg');
      pie.style.setProperty('--tilt-y', '0deg');
    };

    pie.onmousemove = (event) => {
      if (!tooltip) return;
      const rect = pie.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angleRad = Math.atan2(event.clientY - centerY, event.clientX - centerX);
      const deltaX = event.clientX - centerX;
      const deltaY = event.clientY - centerY;
      const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
      const normalized = ((angleRad * 180) / Math.PI + 450) % 360;
      const inside = distance <= rect.width / 2;
      const hit = inside
        ? segments.find((segment) => normalized >= segment.start * 360 && normalized < segment.end * 360)
        : null;

      pie.style.setProperty('--tilt-x', `${Math.max(-8, Math.min(8, -deltaY / 16))}deg`);
      pie.style.setProperty('--tilt-y', `${Math.max(-8, Math.min(8, deltaX / 16))}deg`);

      if (!hit) {
        tooltip.style.display = 'none';
        clearActive();
        return;
      }

      activateSegment(hit.idx);
      const pct = ((hit.part.value / total) * 100).toFixed(2);
      tooltip.textContent = `${hit.part.label}: ${currency(hit.part.value)} (${pct}%)`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${event.pageX + 10}px`;
      tooltip.style.top = `${event.pageY + 10}px`;
    };

    legend.querySelectorAll('li').forEach((item) => {
      item.addEventListener('mouseenter', () => activateSegment(Number(item.dataset.idx)));
      item.addEventListener('mouseleave', clearActive);
    });

    pie.onmouseleave = () => {
      clearActive();
      if (tooltip) tooltip.style.display = 'none';
    };
  }

  function piePath(segment) {
    const startAngle = segment.start * Math.PI * 2 - Math.PI / 2;
    const endAngle = segment.end * Math.PI * 2 - Math.PI / 2;
    const radius = 100;
    const x1 = Math.cos(startAngle) * radius;
    const y1 = Math.sin(startAngle) * radius;
    const x2 = Math.cos(endAngle) * radius;
    const y2 = Math.sin(endAngle) * radius;
    const largeArc = segment.end - segment.start > 0.5 ? 1 : 0;
    return `<path data-idx="${segment.idx}" d="M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${segment.color}" />`;
  }

  function exactProfit(row) {
    const calc = window.PmsTradeMath
      ? window.PmsTradeMath.calculateRoundTrip({ buyPrice: row.buyPrice, soldPrice: row.soldPrice, qty: row.qty })
      : null;
    if (calc) return Number(calc.netProfit || calc.profit || 0);
    const gross = (Number(row.soldPrice || 0) - Number(row.buyPrice || 0)) * Number(row.qty || 0);
    return gross > 0 ? gross * 0.95 : gross;
  }

  function safeJson(raw, fallback) {
    try {
      const parsed = JSON.parse(raw || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function currency(value) {
    return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0)}`;
  }

  const ready = window.__pmsDataReady;
  if (ready && typeof ready.then === 'function') {
    ready.finally(boot);
  } else {
    window.addEventListener('pms-data-ready', boot, { once: true });
    setTimeout(boot, 1200);
  }
})();
