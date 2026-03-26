(() => {
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
    target.innerHTML = `
      <div class="allocation-table-wrap">
        <table class="allocation-table">
          <thead>
            <tr><th>Script</th><th>Value</th><th>Allocation</th></tr>
          </thead>
          <tbody>
            ${normalized.map((row) => {
              const share = total > 0 ? ((row.value / total) * 100).toFixed(2) : '0.00';
              return `<tr><td>${row.script}</td><td>${currency(row.value)}</td><td>${share}%</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  window.PmsAllocation = {
    renderAllocation,
  };
})();
