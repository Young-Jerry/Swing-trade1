(() => {
  const API_URL = 'https://nepsetty.kokomo.workers.dev/api/stock';
  const TARGET_KEYS = ['trades', 'longterm'];
  const SCRIPT_CACHE_KEY = 'portfolioScripts';

  // ✅ FIXED SYMBOL NORMALIZATION
  function normalizeSymbol(value) {
    return String(value || '')
      .toUpperCase()
      .split('.')[0]   // removes .N, .NS etc
      .replace(/[^A-Z]/g, '') // keep only letters
      .trim();
  }

  // ✅ FETCH WITH FULL DEBUG
  async function fetchLtpBySymbol(symbol) {
    const url = `${API_URL}?symbol=${encodeURIComponent(symbol)}`;
    console.log("📡 Fetching:", url);

    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok) {
        console.error(`❌ API failed (${response.status}) for ${symbol}`);
        return null;
      }

      const payload = await response.json();
      console.log(`📊 API response for ${symbol}:`, payload);

      // ✅ FLEXIBLE LTP EXTRACTION
      const ltp = Number(
        payload?.ltp ??
        payload?.data?.ltp ??
        payload?.result?.ltp
      );

      if (!Number.isFinite(ltp)) {
        console.warn(`⚠️ No valid LTP for ${symbol}`);
        return null;
      }

      return ltp;

    } catch (err) {
      console.error(`🔥 Fetch error for ${symbol}:`, err);
      return null;
    }
  }

  // ✅ COLLECT SCRIPTS WITH DEBUG
  function collectPortfolioScripts() {
    const scripts = [];

    for (const key of TARGET_KEYS) {
      const raw = localStorage.getItem(key);
      console.log(`📦 Raw ${key}:`, raw);

      const parsed = JSON.parse(raw || '[]');

      if (!Array.isArray(parsed) || !parsed.length) {
        console.warn(`⚠️ No data in ${key}`);
        continue;
      }

      parsed.forEach((row, i) => {
        console.log(`➡️ Row ${key}[${i}]:`, row);

        const script = normalizeSymbol(
          row.script || row.symbol || row.ticker
        );

        if (script) {
          scripts.push(script);
        } else {
          console.warn(`❌ Invalid script in row:`, row);
        }
      });
    }

    const uniqueScripts = [...new Set(scripts)];
    console.log("✅ Final Scripts:", uniqueScripts);

    localStorage.setItem(SCRIPT_CACHE_KEY, JSON.stringify(uniqueScripts));

    return uniqueScripts;
  }

  // ✅ UPDATE ROW
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

  // ✅ MAIN FUNCTION
  async function applyGlobalLtpUpdate() {
    let totalUpdated = 0;

    const scripts = collectPortfolioScripts();

    if (!scripts.length) {
      console.error("🚨 NO SCRIPTS FOUND — CHECK LOCALSTORAGE");
      return 0;
    }

    const symbolToLtp = new Map();

    // 🔥 FETCH ALL LTPS
    await Promise.all(
      scripts.map(async (script) => {
        const ltp = await fetchLtpBySymbol(script);

        if (Number.isFinite(ltp)) {
          symbolToLtp.set(script, ltp);
        }
      })
    );

    console.log("📌 LTP MAP:", Object.fromEntries(symbolToLtp));

    // 🔄 UPDATE STORAGE
    for (const key of TARGET_KEYS) {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');

      if (!Array.isArray(parsed) || !parsed.length) continue;

      let changed = false;

      const nextRows = parsed.map((row) => {
        const symbol = normalizeSymbol(
          row.script || row.symbol || row.ticker
        );

        const matchedLtp = symbolToLtp.get(symbol);

        if (!Number.isFinite(matchedLtp)) {
          console.warn(`⚠️ No LTP match for ${symbol}`);
          return row;
        }

        changed = true;
        totalUpdated += 1;

        return updateRowWithLtp(row, matchedLtp);
      });

      if (changed) {
        localStorage.setItem(key, JSON.stringify(nextRows));
      }
    }

    if (totalUpdated === 0) {
      console.warn("🚨 NOTHING UPDATED — CHECK API OR SYMBOLS");
    } else {
      console.log(`✅ Updated ${totalUpdated} rows`);
    }

    window.dispatchEvent(
      new CustomEvent('pms-ltp-updated', {
        detail: { updated: totalUpdated },
      })
    );

    return totalUpdated;
  }

  // ✅ BUTTON BIND
  function bindUpdateButton() {
    const button = document.querySelector('[data-update-ltp-btn]');
    const statusNode = document.querySelector('[data-update-ltp-status]');

    if (!button) {
      console.warn("⚠️ Update button not found");
      return;
    }

    button.addEventListener('click', async () => {
      if (button.dataset.loading === '1') return;

      button.dataset.loading = '1';
      const previousLabel = button.textContent;

      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        const updatedCount = await applyGlobalLtpUpdate();

        if (statusNode) {
          statusNode.textContent =
            updatedCount > 0
              ? `✅ Updated ${updatedCount} holdings`
              : `⚠️ No holdings updated (check console)`;

          statusNode.classList.remove('value-loss');
          statusNode.classList.add(
            updatedCount > 0 ? 'value-profit' : 'value-loss'
          );
        }

      } catch (error) {
        console.error('❌ LTP update failed:', error);

        if (statusNode) {
          statusNode.textContent =
            '❌ Failed to fetch LTP (check console)';
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

  // ✅ GLOBAL ACCESS
  window.PmsLtpUpdater = {
    applyGlobalLtpUpdate,
    collectPortfolioScripts,
    fetchLtpBySymbol,
    normalizeSymbol,
  };

  // ✅ INIT
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUpdateButton, {
      once: true,
    });
  } else {
    bindUpdateButton();
  }
})();
