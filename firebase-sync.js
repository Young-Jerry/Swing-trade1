// Deprecated compatibility shim.
// Legacy pages may still load this module; keep it harmless.
window.__pmsDataReady = Promise.resolve();
window.dispatchEvent(new Event('pms-data-ready'));
export {};
