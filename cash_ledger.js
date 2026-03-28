(() => {
  const form = document.getElementById('ledgerForm');
  const body = document.querySelector('#ledgerTable tbody');
  const cashNode = document.getElementById('ledgerCashBalance');
  const clearBtn = document.getElementById('clearLedgerHistoryBtn');

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

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      openWebsiteConfirm({
        title: 'Empty Ledger History',
        message: 'Remove full ledger history and keep only current cash balance?',
        confirmText: 'Empty History',
        onConfirm: () => {
          window.PmsCapital.clearLedgerHistory();
          render();
        },
      });
    });
  }

  render();

  function render() {
    const ledger = window.PmsCapital.readLedger();
    const cash = window.PmsCapital.readCash();
    cashNode.textContent = money(cash);
    body.innerHTML = '';

    const merged = [...ledger]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    merged.forEach((entry) => {
      const tr = document.createElement('tr');
      const isCredit = Number(entry.delta) >= 0;
      tr.innerHTML = `
        <td>${new Date(entry.createdAt).toLocaleString()}</td>
        <td>${isCredit ? 'Cash In' : 'Cash Out'}</td>
        <td>${escapeHtml(entry.source || 'System')}</td>
        <td>${escapeHtml(entry.note || '')}</td>
        <td class="${isCredit ? 'value-profit' : 'value-loss'}">${money(entry.delta)}</td>
        <td class="actions-cell">
          <button class="btn-secondary" data-edit="${entry.id}">✏️</button>
          <button class="btn-danger" data-delete="${entry.id}">🗑️</button>
        </td>
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
        const note = prompt('Correct note:', target.note || '');
        if (note === null) return;
        const nextDelta = target.delta >= 0 ? parsed : -parsed;
        window.PmsCapital.updateLedgerEntry(target.id, {
          delta: nextDelta,
          source: source.trim(),
          note: note.trim(),
          editable: true,
        });
        render();
      });
    });

    body.querySelectorAll('button[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.PmsCapital.deleteLedgerEntry(btn.dataset.delete);
        render();
      });
    });
  }


  function openWebsiteConfirm({ title, message, confirmText, onConfirm }) {
    const existing = document.querySelector('.ledger-confirm-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal ledger-confirm-modal';
    backdrop.innerHTML = `
      <section class="card modal-card">
        <h3>${escapeHtml(title || 'Confirm')}</h3>
        <p class="subtitle">${escapeHtml(message || '')}</p>
        <div class="toolbar" style="justify-content:flex-end; margin-top:12px;">
          <button class="btn-secondary" type="button" data-cancel="true">Cancel</button>
          <button class="btn-danger" type="button" data-confirm="true">${escapeHtml(confirmText || 'Confirm')}</button>
        </div>
      </section>
    `;

    backdrop.querySelector('[data-cancel="true"]').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('[data-confirm="true"]').addEventListener('click', () => {
      if (typeof onConfirm === 'function') onConfirm();
      backdrop.remove();
    });
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    document.body.appendChild(backdrop);
  }

  function money(value) {
    return `Rs ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))}`;
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
