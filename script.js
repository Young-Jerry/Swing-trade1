(() => {
  let booted = false;
  const colors = ['#f4b942', '#2ac07e', '#4e89ff'];

  const boot = () => {
    if (booted) return;
    booted = true;
    const keys = [
      { id: 'trades', label: 'Trades', node: 'totalTrades', total: tradeLikeTotal },
      { id: 'longterm', label: 'Long Term', node: 'totalLongTerm', total: tradeLikeTotal },
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
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    const records = Object.values(state.records || {});
    return records.flat().reduce((sum, row) => sum + Number(row.amount || 0), 0);
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
    const yRange = (maxY - minY) || 1;
    const toX = (i) => pad.left + (i / Math.max(points.length - 1, 1)) * plotW;
    const toY = (v) => pad.top + (1 - ((v - minY) / yRange)) * plotH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1d2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawPoint = (i) => ({ x: toX(i), y: toY(points[i].total) });
    const first = drawPoint(0);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const prev = drawPoint(i - 1);
      const curr = drawPoint(i);
      const midX = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, (prev.y + curr.y) / 2);
      if (i === points.length - 1) ctx.quadraticCurveTo(curr.x, curr.y, curr.x, curr.y);
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
      ctx.arc(x, y, i === points.length - 1 ? 4 : 2.5, 0, Math.PI * 2);
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
    if (Number.isFinite(Number(row.profit))) return Number(row.profit);
    const calc = window.PmsTradeMath
      ? window.PmsTradeMath.calculateRoundTrip({ buyPrice: row.buyPrice, soldPrice: row.soldPrice, qty: row.qty })
      : null;
    return calc ? calc.profit : (Number(row.soldPrice || 0) - Number(row.buyPrice || 0)) * Number(row.qty || 0);
  }

  function exactInvested(row) {
    if (Number.isFinite(Number(row.buyTotal))) return Number(row.buyTotal);
    const calc = window.PmsTradeMath
      ? window.PmsTradeMath.calculateRoundTrip({ buyPrice: row.buyPrice, soldPrice: row.soldPrice, qty: row.qty })
      : null;
    return calc ? calc.invested : Number(row.buyPrice || 0) * Number(row.qty || 0);
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
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      pie.style.setProperty('--tilt-x', `${(relY - 0.5) * -8}deg`);
      pie.style.setProperty('--tilt-y', `${(relX - 0.5) * 8}deg`);
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
      pie.style.setProperty('--tilt-x', '0deg');
      pie.style.setProperty('--tilt-y', '0deg');
      tooltip.style.display = 'none';
    });
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
