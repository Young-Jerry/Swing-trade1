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
