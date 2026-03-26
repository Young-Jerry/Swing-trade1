(() => {
  const API_URL = 'https://fragrant-haze-8bc2.sohaummainali685.workers.dev';
  const TARGET_KEYS = ['trades', 'longterm'];
  const SCRIPT_CACHE_KEY = 'portfolioScripts';

  // ✅ Normalize script symbols
  function normalizeSymbol(value) {
    return String(value || '')
      .toUpperCase()
      .split('.')[0]          // remove .N, .NS, etc
      .replace(/[^A-Z]/g, '') // keep only letters
      .trim();
  }

  // ✅ Fetch LTP from your Cloudflare Worker
  async function fetchLtpBySymbol(symbol) {
    const url = `${API_URL}?symbol=${symbol}`;
    console.log("📡 Fetching LTP:", url);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`❌ Fetch failed for ${symbol} — ${response.status}`);
        return null;
      }
      const payload = await response.json();
      console.log(`📊 API response for ${symbol}:`, payload);

      const ltp = Number(payload?.ltp);
      if (!Number.isFinite(ltp)) {
        console.warn(`⚠️ Invalid LTP for ${symbol}`);
        return null;
      }

      return ltp;
    } catch (err) {
      console.error(`🔥 Error fetching ${symbol}:`, err);
      return null;
    }
  }

  // ✅ Collect all scripts from localStorage
  function collectPortfolioScripts() {
    const scripts = [];

    for (const key of TARGET_KEYS) {
      const raw = localStorage.getItem(key);
      const parsed = JSON.parse(raw || '[]');

      if (!Array.isArray(parsed) || !parsed.length) continue;

      parsed.forEach((row) => {
        const script = normalizeSymbol(row.script || row.symbol || row.ticker);
        if (script) scripts.push(script);
      });
    }

    const uniqueScripts = [...new Set(scripts)];
    console.log("✅ Final scripts:", uniqueScripts);
    localStorage.setItem(SCRIPT_CACHE_KEY, JSON.stringify(uniqueScripts));
    return uniqueScripts;
  }

  // ✅ Update a single row with LTP and calculate P/L
  function updateRowWithLtp(row, ltp) {
    const qty = Number(row.qty || 0);
    const wacc = Number(row.wacc || 0);

    const invested = qty * wacc;
    const current = qty * ltp;
    const profitLoss = current - invested;
    const percentReturn = invested > 0 ? (profitLoss / invested) * 100 : 0;

    return {
      ...row,
      ltp,
      currentValue: current,
      profitLoss,
      percentReturn,
    };
  }

  // ✅ Main function: update all rows
  async function applyGlobalLtpUpdate() {
    let totalUpdated = 0;
    const scripts = collectPortfolioScripts();
    if (!scripts.length) {
      console.error("🚨 No scripts found in localStorage");
      return 0;
    }

    // 🔥 Fetch LTPs in parallel
    const symbolToLtp = new Map();
    await Promise.all(
      scripts.map(async (script) => {
        const ltp = await fetchLtpBySymbol(script);
        if (Number.isFinite(ltp)) symbolToLtp.set(script, ltp);
      })
    );

    console.log("📌 LTP Map:", Object.fromEntries(symbolToLtp));

    // 🔄 Update localStorage rows
    for (const key of TARGET_KEYS) {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(parsed) || !parsed.length) continue;

      let changed = false;
      const updatedRows = parsed.map((row) => {
        const symbol = normalizeSymbol(row.script || row.symbol || row.ticker);
        const ltp = symbolToLtp.get(symbol);

        if (!Number.isFinite(ltp)) return row;

        changed = true;
        totalUpdated += 1;
        return updateRowWithLtp(row, ltp);
      });

      if (changed) localStorage.setItem(key, JSON.stringify(updatedRows));
    }

    if (totalUpdated === 0) {
      console.warn("🚨 Nothing updated — check API or symbols");
    } else {
      console.log(`✅ Updated ${totalUpdated} rows`);
    }

    window.dispatchEvent(
      new CustomEvent('pms-ltp-updated', { detail: { updated: totalUpdated } })
    );

    return totalUpdated;
  }

  // ✅ Bind update button
  function bindUpdateButton() {
    const button = document.querySelector('[data-update-ltp-btn]');
    const statusNode = document.querySelector('[data-update-ltp-status]');

    if (!button) return;

    button.addEventListener('click', async () => {
      if (button.dataset.loading === '1') return;

      button.dataset.loading = '1';
      const prevLabel = button.textContent;
      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        const updatedCount = await applyGlobalLtpUpdate();
        if (statusNode) {
          statusNode.textContent =
            updatedCount > 0
              ? `✅ Updated ${updatedCount} holdings`
              : `⚠️ No holdings updated`;

          statusNode.classList.toggle('value-profit', updatedCount > 0);
          statusNode.classList.toggle('value-loss', updatedCount === 0);
        }
      } catch (err) {
        console.error('❌ LTP update failed:', err);
        if (statusNode) {
          statusNode.textContent = '❌ Failed to fetch LTP';
          statusNode.classList.add('value-loss');
          statusNode.classList.remove('value-profit');
        }
      } finally {
        button.dataset.loading = '0';
        button.disabled = false;
        button.textContent = prevLabel;
      }
    });
  }

  // ✅ Expose globally
  window.PmsLtpUpdater = {
    applyGlobalLtpUpdate,
    collectPortfolioScripts,
    fetchLtpBySymbol,
    normalizeSymbol,
  };

  // ✅ Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUpdateButton, { once: true });
  } else {
    bindUpdateButton();
  }
})();
