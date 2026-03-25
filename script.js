import { subscribeData } from './firebase-db.js';

const colors = ['#f4b942', '#2ac07e', '#4e89ff'];
let trades = {};
let longterm = {};
let mutualFunds = { records: {} };
let pastTrades = {};

subscribeData('trades', (data) => { trades = data || {}; render(); });
subscribeData('longterm', (data) => { longterm = data || {}; render(); });
subscribeData('mutualFunds', (data) => { mutualFunds = data || { records: {} }; render(); });
subscribeData('pastTrades', (data) => { pastTrades = data || {}; render(); });

function render() {
  const totalTrades = tradeLikeTotal(trades);
  const totalLongTerm = tradeLikeTotal(longterm);
  const totalMF = sipTotal(mutualFunds);
  const combined = totalTrades + totalLongTerm + totalMF;

  document.getElementById('totalTrades').textContent = currency(totalTrades);
  document.getElementById('totalLongTerm').textContent = currency(totalLongTerm);
  document.getElementById('totalMF').textContent = currency(totalMF);
  document.getElementById('combinedTotal').textContent = currency(combined);

  renderPie([
    { label: 'Trades', value: totalTrades },
    { label: 'Long Term', value: totalLongTerm },
    { label: 'SIP System', value: totalMF },
  ], combined);

  renderProfitPanel();
}

function tradeLikeTotal(rowsObj) {
  return Object.values(rowsObj || {}).reduce((s, r) => s + (Number(r.ltp || 0) * Number(r.qty || 0)), 0);
}

function sipTotal(state) {
  const records = Object.values((state || {}).records || {});
  return records.flat().reduce((sum, row) => sum + Number(row.amount || (Number(row.units || 0) * Number(row.nav || 0))), 0);
}

function renderProfitPanel() {
  const rows = Object.values(pastTrades || {});
  const totalProfit = rows.reduce((sum, row) => sum + exactProfit(row), 0);
  const totalInvested = rows.reduce((sum, row) => sum + (Number(row.buyPrice || 0) * Number(row.qty || 0)), 0);
  const wins = rows.filter((row) => exactProfit(row) > 0).length;
  const losses = rows.filter((row) => exactProfit(row) < 0).length;

  const profitNode = document.getElementById('profitValue');
  profitNode.textContent = currency(totalProfit);
  profitNode.className = totalProfit >= 0 ? 'value-profit' : 'value-loss';
  document.getElementById('totalInvested').textContent = currency(totalInvested);
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
  const signedLog = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n === 0) return 0;
    return Math.sign(n) * Math.log10(1 + Math.abs(n));
  };
  const rawMin = Math.min(0, ...points.map((p) => p.total));
  const transformed = points.map((p) => signedLog(p.total));
  const minY = Math.min(...transformed, signedLog(0));
  const maxY = Math.max(...transformed, signedLog(1));
  const yRange = maxY - minY || 1;
  const toX = (i) => pad.left + (i / Math.max(points.length - 1, 1)) * plotW;
  const toY = (v) => pad.top + (1 - ((signedLog(v) - minY) / yRange)) * plotH;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f1d2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = toX(i);
    const y = toY(p.total);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  const stroke = points[points.length - 1].total >= 0 ? '#00e540' : '#ea5a5a';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left - pad.left;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round((relX / plotW) * (points.length - 1))));
    const point = points[idx];
    tooltip.textContent = idx === 0 ? 'Start: ₨0' : `Trade ${idx}: Total Profit ${currency(point.total)}`;
    tooltip.style.display = 'block';
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
  };
  canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
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

  pie.onmousemove = (e) => {
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
  };
  pie.onmouseleave = () => { tooltip.style.display = 'none'; };
}

function exactProfit(row) { return (Number(row.soldPrice || 0) - Number(row.buyPrice || 0)) * Number(row.qty || 0); }
function currency(value) { return `₨${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`; }
