(() => {
  let booted = false;
  const colors = ['#f4b942', '#2ac07e', '#4e89ff'];

  const boot = () => {
    if (booted) return;
    booted = true;
    const keys = [
      { id: 'trades', label: 'Trades', node: 'totalTrades', total: tradeLikeTotal },
      { id: 'longterm', label: 'Long Term', node: 'totalLongTerm', total: tradeLikeTotal },
      { id: 'sipStateV4', label: 'SIP', node: 'totalSip', total: sipTotal },
    ];

    const totals = keys.map((k) => ({ ...k, value: k.total(k.id) }));
    const combined = totals.reduce((s, x) => s + x.value, 0);

    totals.forEach((t) => {
      const node = document.getElementById(t.node);
      if (node) node.textContent = currency(t.value);
    });
    document.getElementById('combinedTotal').textContent = currency(combined);

    renderPie(totals, combined);
    renderProfitPanel();
    bindBackupControls();
    if (window.PmsCapital) window.PmsCapital.updateWidgets();
  };

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
        const a = document.createElement('a');
        a.href = url;
        a.download = `NP ${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
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
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
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

    const entries = Object.entries(data).filter(([key, value]) => typeof key === 'string' && typeof value === 'string');
    if (!entries.length) throw new Error('No restorable data in file');

    localStorage.clear();
    entries.forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }

  function tradeLikeTotal(key) {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return rows.reduce((s, r) => s + (Number(r.ltp || 0) * Number(r.qty || 0)), 0);
  }

  function sipTotal(key) {
    const state = JSON.parse(
      localStorage.getItem(key)
      || localStorage.getItem('sipStateV3')
      || localStorage.getItem('sipStateV2')
      || '{}',
    );
    const currentNav = state.currentNav || {};
    const records = Object.entries(state.records || {});
    return records.reduce((sum, [sipName, list]) => {
      const rows = Array.isArray(list) ? list : [];
      const units = rows.reduce((u, row) => u + Number(row.units || 0), 0);
      const lastNav = Number(rows[rows.length - 1]?.nav || 0);
      const nav = Number(currentNav[sipName] || lastNav || 0);
      if (nav > 0 && units > 0) return sum + (units * nav);
      return sum + rows.reduce((s, row) => s + Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0))), 0);
    }, 0);
  }

  function renderProfitPanel() {
    const rows = JSON.parse(localStorage.getItem('exitedTradesV2') || '[]');
    const totalProfit = rows.reduce((sum, row) => sum + exactProfit(row), 0);
    const wins = rows.filter((row) => exactProfit(row) > 0).length;
    const losses = rows.filter((row) => exactProfit(row) < 0).length;

    const profitNode = document.getElementById('profitValue');
    profitNode.textContent = currency(totalProfit);
    profitNode.className = totalProfit >= 0 ? 'value-profit' : 'value-loss';
    document.getElementById('winCount').textContent = String(wins);
    document.getElementById('lossCount').textContent = String(losses);

    drawProfitChart(rows);
  }

  function drawProfitChart(rows) {
    const canvas = document.getElementById('profitChart');
    const tooltip = document.getElementById('chartTooltip');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = [{ index: 0, total: 0 }];
    let cumulative = 0;
    rows.forEach((row, index) => {
      cumulative += exactProfit(row);
      points.push({ index: index + 1, total: cumulative });
    });

    const pad = { left: 20, right: 20, top: 16, bottom: 20 };
    const plotW = canvas.width - pad.left - pad.right;
    const plotH = canvas.height - pad.top - pad.bottom;
    const values = points.map((p) => p.total);
    const minY = Math.min(0, ...values);
    const maxY = Math.max(0, ...values);
    const spread = (maxY - minY) || 1;
    const yPad = spread * 0.08;
    const yMinPadded = minY - yPad;
    const yMaxPadded = maxY + yPad;
    const yRange = (yMaxPadded - yMinPadded) || 1;
    const toX = (i) => pad.left + (i / Math.max(points.length - 1, 1)) * plotW;
    const toY = (v) => pad.top + (1 - ((v - yMinPadded) / yRange)) * plotH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1d2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawPoint = (i) => ({ x: toX(i), y: toY(points[i].total) });
    const xy = points.map((_, i) => drawPoint(i));
    ctx.beginPath();

    ctx.moveTo(xy[0].x, xy[0].y);
    for (let i = 0; i < xy.length - 1; i += 1) {
      const p0 = xy[Math.max(0, i - 1)];
      const p1 = xy[i];
      const p2 = xy[i + 1];
      const p3 = xy[Math.min(xy.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const curr = drawPoint(i);
      ctx.lineTo(curr.x, curr.y);
    }
    const stroke = points[points.length - 1].total >= 0 ? '#00e540' : '#ea5a5a';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    const baseline = toY(0);
    ctx.lineTo(toX(points.length - 1), baseline);
    ctx.lineTo(toX(0), baseline)
    ctx.closePath();
    ctx.fillStyle = points[points.length - 1].total >= 0 ? 'rgba(0, 229, 64, 0.2)' : 'rgba(234, 90, 90, 0.2)';
    ctx.fill();

    points.forEach((p, i) => {
      const x = toX(i);
      const y = toY(p.total);
      ctx.beginPath();
      ctx.arc(x, y, i === points.length - 1 ? 4.5 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = i === points.length - 1 ? '#ffffff' : stroke;
      ctx.fill();
    });

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left - pad.left;
      const idx = Math.max(0, Math.min(points.length - 1, Math.round((relX / plotW) * (points.length - 1))));
      const point = points[idx];
      tooltip.textContent = idx === 0
        ? 'Start: Rs 0'
        : `Trade ${idx}: Total Profit ${currency(point.total)}`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
    };
    canvas.onmouseleave = () => {
      tooltip.style.display = 'none';
    };
  }

  function exactProfit(row) {
    const calc = window.PmsTradeMath
      ? window.PmsTradeMath.calculateRoundTrip({ buyPrice: row.buyPrice, soldPrice: row.soldPrice, qty: row.qty })
      : null;
    if (calc) return Number(calc.netProfit || calc.profit || 0);
    const gross = (Number(row.soldPrice || 0) - Number(row.buyPrice || 0)) * Number(row.qty || 0);
    return gross > 0 ? gross * 0.95 : gross;
  }

  function renderPie(parts, total) {
    const pie = document.getElementById('allocationPie');
    const legend = document.getElementById('allocationLegend');
    const tooltip = document.getElementById('chartTooltip');
    if (!total) {
      pie.innerHTML = '<div class="pie-empty">No data</div>';
      legend.innerHTML = '<li>No holdings available.</li>';
      return;
    }

    let acc = 0;
    const segments = parts.map((p, i) => {
      const share = p.value / total;
      const start = acc;
      acc += share;
      return { color: colors[i], start, end: acc, part: p, idx: i };
    });

    pie.innerHTML = `
      <svg class="allocation-svg" viewBox="-120 -120 240 240" role="img" aria-label="Allocation pie chart">
        ${segments.map((seg) => piePath(seg)).join('')}
      </svg>
    `;
    const paths = [...pie.querySelectorAll('path[data-idx
    pie.style.background = `conic-gradient(${segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(',')})`;
    pie.style.setProperty('--pie-glow', colors[0]);

    legend.innerHTML = '';
    parts.forEach((p, i) => {
      const li = document.createElement('li');
      li.dataset.idx = String(i);
      const pct = ((p.value / total) * 100).toFixed(1);
      li.innerHTML = `<span><span class="dot" style="background:${colors[i]}"></span>${p.label}</span><strong>${pct}% (${currency(p.value)})</strong>`;
      legend.appendChild(li);
    });

    const activateSegment = (idx) => {
      paths.forEach((path) => {
        const active = Number(path.dataset.idx) === idx;
        path.classList.toggle('active', active);
        path.classList.toggle('inactive', !active);
      });
      legend.querySelectorAll('li').forEach((li) => {
        li.classList.toggle('active', Number(li.dataset.idx) === idx);
      });
      const hit = segments[idx];
      if (hit) pie.style.setProperty('--pie-glow', hit.color);
    };
    const clearActive = () => {
      paths.forEach((path) => path.classList.remove('active', 'inactive'));
      legend.querySelectorAll('li').forEach((li) => li.classList.remove('active'));
      pie.style.setProperty('--pie-glow', colors[0]);
    };

    pie.addEventListener('mousemove', (e) => {
      const rect = pie.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angleRad = Math.atan2(e.clientY - cy, e.clientX - cx);
      const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2);
      const normalized = ((angleRad * 180) / Math.PI + 450) % 360;
      const insideRadius = dist <= (rect.width / 2);
      const hit = insideRadius ? segments.find((seg) => normalized >= seg.start * 360 && normalized < seg.end * 360) : null;
      if (!hit) return;

      activateSegment(hit.idx);
      pie.style.setProperty('--pie-glow', hit.color);
      const pct = ((hit.part.value / total) * 100).toFixed(2);
      tooltip.textContent = `${hit.part.label}: ${currency(hit.part.value)} (${pct}%)`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
    });

    legend.querySelectorAll('li').forEach((li) => {
      li.addEventListener('mouseenter', () => activateSegment(Number(li.dataset.idx)));
      li.addEventListener('mouseleave', clearActive);
    });

    pie.addEventListener('mouseleave', () => {
      clearActive();
      tooltip.style.display = 'none';
    });
  }

  function piePath(segment) {
    const startAngle = segment.start * Math.PI * 2 - (Math.PI / 2);
    const endAngle = segment.end * Math.PI * 2 - (Math.PI / 2);
    const r = 100;
    const x1 = Math.cos(startAngle) * r;
    const y1 = Math.sin(startAngle) * r;
    const x2 = Math.cos(endAngle) * r;
    const y2 = Math.sin(endAngle) * r;
    const largeArc = segment.end - segment.start > 0.5 ? 1 : 0;
    return `<path data-idx="${segment.idx}" d="M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${segment.color}" />`;
  }

  function currency(value) {
    return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;
  }

  const ready = window.__pmsDataReady;
  if (ready && typeof ready.then === 'function') {
    ready.finally(boot);
  } else {
    window.addEventListener('pms-data-ready', boot, { once: true });
    setTimeout(boot, 1200);
  }
})();
