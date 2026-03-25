(() => {
  const API_URL = 'https://bishaludash.com.np/NEPSE-Api/api/todayshare.json';
  const TARGET_KEYS = ['trades', 'longterm'];

  const SYMBOL_ALIAS_MAP = {
    'EVEREST BANK LIMITED': 'EBL',
  };

  const stopWords = new Set([
    'LIMITED', 'LTD', 'COMPANY', 'CO', 'BANK', 'DEBENTURE', 'DEVELOPMENT', 'FINANCE',
    'MICROFINANCE', 'MICRO', 'INSURANCE', 'LIFE', 'NON', 'HYDROPOWER', 'HYDRO', 'POWER',
    'MUTUAL', 'FUND', 'AND', '&', 'THE', 'PVT', 'PRABHU', 'PERCENT', 'BONUS', 'PROMOTER',
  ]);

  function normalizeText(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildInitialSymbol(companyName) {
    const normalized = normalizeText(companyName);
    if (!normalized) return '';
    if (SYMBOL_ALIAS_MAP[normalized]) return SYMBOL_ALIAS_MAP[normalized];

    const parts = normalized
      .split(' ')
      .filter((part) => part && !/^\d/.test(part) && !stopWords.has(part));

    const initials = parts.map((part) => part[0]).join('');
    if (initials.length >= 2 && initials.length <= 5) return initials;

    return parts.join('').slice(0, 4);
  }

  function createSymbolTokens(companyName) {
    const normalized = normalizeText(companyName);
    const initials = buildInitialSymbol(companyName);
    const compact = normalized.replace(/\s+/g, '');

    return new Set([normalized, initials, compact].filter(Boolean));
  }

  function buildPriceLookup(apiRows) {
    const bySymbol = new Map();

    apiRows.forEach((entry) => {
      const companyName = entry['Traded Companies'];
      const close = Number(entry['Closing Price']);
      if (!companyName || !Number.isFinite(close)) return;

      const tokens = createSymbolTokens(companyName);
      tokens.forEach((token) => bySymbol.set(token, close));
    });

    return bySymbol;
  }

  function matchPrice(script, lookup) {
    const symbol = normalizeText(script);
    if (!symbol) return null;

    const compact = symbol.replace(/\s+/g, '');
    if (lookup.has(symbol)) return lookup.get(symbol);
    if (lookup.has(compact)) return lookup.get(compact);

    for (const [token, price] of lookup.entries()) {
      if (token.includes(symbol) || symbol.includes(token)) {
        return price;
      }
    }

    return null;
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
    const response = await fetch(API_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const apiRows = await response.json();
    if (!Array.isArray(apiRows)) {
      throw new Error('Unexpected API response format.');
    }

    const lookup = buildPriceLookup(apiRows);

    let totalUpdated = 0;
    TARGET_KEYS.forEach((key) => {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(parsed) || !parsed.length) return;

      let changed = false;
      const nextRows = parsed.map((row) => {
        const matchedLtp = matchPrice(row.script, lookup);
        if (!Number.isFinite(matchedLtp)) return row;
        changed = true;
        totalUpdated += 1;
        return updateRowWithLtp(row, matchedLtp);
      });

      if (changed) {
        localStorage.setItem(key, JSON.stringify(nextRows));
      }
    });

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
          statusNode.textContent = `Updated ${updatedCount} holding(s) from live closing prices.`;
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
    normalizeText,
    buildInitialSymbol,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUpdateButton, { once: true });
  } else {
    bindUpdateButton();
  }
})();
