(() => {
  const FIREBASE_DB_URL = 'https://nepse-explained-default-rtdb.asia-southeast1.firebasedatabase.app';
  const REMOTE_PATH = 'websiteDataV1';
  const META_KEY = '__firebaseSyncMeta__';
  let suppressSync = false;
  let syncTimer;

  const storageProto = Storage.prototype;
  const originalSetItem = storageProto.setItem.bind(localStorage);
  const originalRemoveItem = storageProto.removeItem.bind(localStorage);
  const originalClear = storageProto.clear.bind(localStorage);

  function shouldTrackKey(key) {
    return key && key !== META_KEY;
  }

  function safeSetItem(key, value) {
    suppressSync = true;
    try {
      originalSetItem(key, value);
    } finally {
      suppressSync = false;
    }
  }

  function installLocalStorageHooks() {
    storageProto.setItem = function setItemPatched(key, value) {
      originalSetItem(key, value);
      if (suppressSync || !shouldTrackKey(key)) return;
      scheduleSync();
    };

    storageProto.removeItem = function removeItemPatched(key) {
      originalRemoveItem(key);
      if (suppressSync || !shouldTrackKey(key)) return;
      scheduleSync();
    };

    storageProto.clear = function clearPatched() {
      originalClear();
      if (suppressSync) return;
      scheduleSync();
    };
  }

  function collectLocalStorage() {
    const keys = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!shouldTrackKey(key)) continue;
      keys[key] = localStorage.getItem(key);
    }
    return {
      keys,
      updatedAt: new Date().toISOString(),
      source: 'web-client',
    };
  }

  async function pushAll() {
    try {
      const payload = collectLocalStorage();
      safeSetItem(META_KEY, JSON.stringify({ lastPushAt: payload.updatedAt }));
      await fetch(`${FIREBASE_DB_URL}/${REMOTE_PATH}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn('Firebase sync push failed:', error);
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushAll();
    }, 350);
  }

  async function hydrateFromRemote() {
    try {
      const response = await fetch(`${FIREBASE_DB_URL}/${REMOTE_PATH}.json`, { method: 'GET' });
      if (!response.ok) return;
      const remote = await response.json();
      const keys = remote && typeof remote === 'object' ? remote.keys : null;
      if (!keys || typeof keys !== 'object') return;

      suppressSync = true;
      Object.entries(keys).forEach(([key, value]) => {
        if (!shouldTrackKey(key)) return;
        if (typeof value !== 'string') return;
        originalSetItem(key, value);
      });
    } catch (error) {
      console.warn('Firebase sync hydrate failed:', error);
    } finally {
      suppressSync = false;
    }
  }

  installLocalStorageHooks();

  window.__pmsDataReady = (async () => {
    await hydrateFromRemote();
    await pushAll();
    return true;
  })();
})();
