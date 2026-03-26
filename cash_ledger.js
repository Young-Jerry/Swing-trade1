(() => {
  const form = document.getElementById('ledgerForm');
  const body = document.querySelector('#ledgerTable tbody');
  const cashNode = document.getElementById('ledgerCashBalance');

  if (!form || !body) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const type = String(fd.get('type'));
    const amount = Number(fd.get('amount'));
    const source = String(fd.get('source') || '').trim();
    const note = String(fd.get('note') || '').trim();

    if (!Number.isFinite(amount) || amount <= 0 || !source) return;
    const delta = type === 'credit' ? amount : -amount;
    window.PmsCapital.adjustCash(delta, {
      source,
      note,
      kind: 'manual',
      type,
      editable: true,
    });
    form.reset();
    render();
  });

  render();

  function render() {
    const ledger = window.PmsCapital.readLedger();
    const cash = window.PmsCapital.readCash();
    cashNode.textContent = money(cash);
    body.innerHTML = '';

    ledger.slice().reverse().forEach((entry) => {
      const tr = document.createElement('tr');
      const type = Number(entry.delta) >= 0 ? 'Cash In' : 'Cash Out';
      tr.innerHTML = `
        <td>${new Date(entry.createdAt).toLocaleString()}</td>
        <td>${type}</td>
        <td>${escapeHtml(entry.source || 'System')}</td>
        <td>${escapeHtml(entry.note || '')}</td>
        <td class="${Number(entry.delta) >= 0 ? 'value-profit' : 'value-loss'}">${money(entry.delta)}</td>
        <td class="actions-cell">${entry.editable ? `<button class="btn-secondary" data-edit="${entry.id}">Edit</button>` : ''}</td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll('button[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = ledger.find((row) => row.id === btn.dataset.edit);
        if (!target) return;
        const amount = prompt('Correct amount:', String(Math.abs(target.delta)));
        if (amount === null) return;
        const parsed = Number(amount);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        const source = prompt('Correct source:', target.source || 'Manual correction');
        if (source === null || !source.trim()) return;
        const nextDelta = target.delta >= 0 ? parsed : -parsed;
        window.PmsCapital.updateLedgerEntry(target.id, {
          delta: nextDelta,
          source: source.trim(),
          note: `${target.note || ''} (Corrected)`.trim(),
        });
        render();
      });
    });
  }

  function money(value) {
    return `Rs ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
