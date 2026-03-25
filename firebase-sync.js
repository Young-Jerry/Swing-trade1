window.__pmsDataReady = Promise.resolve().finally(() => {
  window.dispatchEvent(new Event('pms-data-ready'));
});
