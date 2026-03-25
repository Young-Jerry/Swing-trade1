import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getDatabase, ref, set, get, push, update, remove, onValue } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js';

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
const db = getDatabase(app);

function norm(path) {
  return String(path || '').replace(/^\/+/, '');
}

export function saveData(path, data) {
  return set(ref(db, norm(path)), data);
}

export async function getData(path) {
  const snapshot = await get(ref(db, norm(path)));
  return snapshot.exists() ? snapshot.val() : null;
}

export function updateData(path, data) {
  return update(ref(db, norm(path)), data);
}

export function deleteData(path) {
  return remove(ref(db, norm(path)));
}

export async function pushData(path, data) {
  const childRef = push(ref(db, norm(path)));
  await set(childRef, data);
  return childRef.key;
}

export function subscribeData(path, callback) {
  return onValue(ref(db, norm(path)), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
}

export { db };
