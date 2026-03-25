
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js';
import { getDatabase, get, onValue, ref, set } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCHy8DIDOjEqWHAljuElmu3lFZCxxvsd1s',
  authDomain: 'nepse-explained.firebaseapp.com',
  databaseURL: 'https://nepse-explained-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'nepse-explained',
  storageBucket: 'nepse-explained.firebasestorage.app',
  messagingSenderId: '768766520140',
  appId: '1:768766520140:web:63f7505b9cd82ae8b07de9',
  measurementId: 'G-8J9R9GWRTX',
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch {}
const db = getDatabase(app);
const storageRef = ref(db, 'websiteDataV2');

const META_KEY = '__firebaseSyncMeta__';
const storageProto = Storage.prototype;
const originalSetItem = storageProto.setItem;
const originalRemoveItem = storageProto.removeItem;
const originalClear = storageProto.clear;
let suppressSync = false;
let syncTimer;

function shouldTrackKey(key) {
  return Boolean(key) && key !== META_KEY;
}

function collectLocalData() {
  const keys = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!shouldTrackKey(key)) continue;
    keys[key] = localStorage.getItem(key);
  }
  return { keys, updatedAt: new Date().toISOString(), source: 'web-client' };
}

async function pushAll() {
  if (suppressSync) return;
  const payload = collectLocalData();
  suppressSync = true;
  try {
    originalSetItem.call(localStorage, META_KEY, JSON.stringify({ lastPushAt: payload.updatedAt }));
  } finally {
    suppressSync = false;
  }
  await set(storageRef, payload);
}

function schedulePush() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushAll().catch((err) => console.warn('Firebase push failed:', err));
  }, 250);
}

function applyRemote(remote) {
  const keys = remote && typeof remote === 'object' ? remote.keys : null;
  if (!keys || typeof keys !== 'object') return;
  suppressSync = true;
  try {
    Object.entries(keys).forEach(([key, value]) => {
      if (!shouldTrackKey(key) || typeof value !== 'string') return;
      originalSetItem.call(localStorage, key, value);
    });
  } finally {
    suppressSync = false;
  }
}

function patchStorage() {
  storageProto.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (!suppressSync && shouldTrackKey(key)) schedulePush();
  };
  storageProto.removeItem = function patchedRemoveItem(key) {
    originalRemoveItem.call(this, key);
    if (!suppressSync && shouldTrackKey(key)) schedulePush();
  };
  storageProto.clear = function patchedClear() {
    originalClear.call(this);
    if (!suppressSync) schedulePush();
  };
}

async function bootstrap() {
  patchStorage();
  const snap = await get(storageRef);
  if (snap.exists()) applyRemote(snap.val());
  await pushAll();

  onValue(storageRef, (snapshot) => {
    if (suppressSync || !snapshot.exists()) return;
    applyRemote(snapshot.val());
  });
}

window.__pmsDataReady = bootstrap()
  .catch((err) => {
    console.warn('Firebase bootstrap failed:', err);
  })
  .finally(() => {
    window.dispatchEvent(new Event('pms-data-ready'));
  });
=======
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
