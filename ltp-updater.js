(() => {
  const API_URL = 'https://nepsetty.kokomo.workers.dev/api/stock';
  const TARGET_KEYS = ['trades', 'longterm'];


  function normalizeSymbol(value) {
    return String(value || '')
      .toUpperCase()
  function normalizeText(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .trim();
  }

  async function fetchLtpBySymbol(symbol) {
    const url = `${API_URL}?symbol=${encodeURIComponent(symbol)}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`API request failed (${response.status}) for ${symbol}`);
    }

    const payload = await response.json();
    const ltp = Number(payload?.ltp);
    return Number.isFinite(ltp) ? ltp : null;
  }

  function updateRowWithLtp(row, ltp) {
    const qty = Number(row.qty || 0);
    const wacc = Number(row.wacc || 0);
    const invested = qty * wacc;
    const current = qty * ltp;
    const profitLoss = current - invested;
    const percent = invested > 0 ? (profitLoss / invested) * 100 : 0;

    return {
      ...row,
      ltp,
      currentValue: current,
      profitLoss,
      percentReturn: percent,
    };
  }

  async function applyGlobalLtpUpdate() {
    let totalUpdated = 0;
    for (const key of TARGET_KEYS) {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(parsed) || !parsed.length) continue;

      const symbolSet = new Set(
        parsed
          .map((row) => normalizeSymbol(row.script))
          .map((row) => normalizeText(row.script))
          .filter(Boolean)
      );

      const symbolToLtp = new Map();
      await Promise.all([...symbolSet].map(async (symbol) => {
        try {
          const ltp = await fetchLtpBySymbol(symbol);
          if (Number.isFinite(ltp)) symbolToLtp.set(symbol, ltp);
        } catch (error) {
          console.warn(`Unable to fetch LTP for ${symbol}:`, error);
        }
      }));

      let changed = false;
      const nextRows = parsed.map((row) => {
        const symbol = normalizeSymbol(row.script);
        const symbol = normalizeText(row.script);
        const matchedLtp = symbolToLtp.get(symbol);
        if (!Number.isFinite(matchedLtp)) return row;
        changed = true;
        totalUpdated += 1;
        return updateRowWithLtp(row, matchedLtp);
      });

      if (changed) {
        localStorage.setItem(key, JSON.stringify(nextRows));
      }
    }

    window.dispatchEvent(new CustomEvent('pms-ltp-updated', { detail: { updated: totalUpdated } }));
    return totalUpdated;
  }

  function bindUpdateButton() {
    const button = document.querySelector('[data-update-ltp-btn]');
    const statusNode = document.querySelector('[data-update-ltp-status]');
    if (!button) return;

    button.addEventListener('click', async () => {
      if (button.dataset.loading === '1') return;
      button.dataset.loading = '1';
      const previousLabel = button.textContent;
      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        const updatedCount = await applyGlobalLtpUpdate();
        if (statusNode) {
          statusNode.textContent = `Updated ${updatedCount} holding(s) from live API prices.`;
          statusNode.classList.remove('value-loss');
          statusNode.classList.add('value-profit');
        }
      } catch (error) {
        console.error('LTP update failed:', error);
        if (statusNode) {
          statusNode.textContent = 'Unable to fetch LTP right now. Existing values were not changed.';
          statusNode.classList.remove('value-profit');
          statusNode.classList.add('value-loss');
        }
      } finally {
        button.dataset.loading = '0';
        button.disabled = false;
        button.textContent = previousLabel;
      }
    });
  }

  window.PmsLtpUpdater = {
    applyGlobalLtpUpdate,
    normalizeSymbol,
    normalizeText,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUpdateButton, { once: true });
  } else {
    bindUpdateButton();
  }
})();
