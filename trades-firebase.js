import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  remove,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js';

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
const tradesRef = ref(db, 'trades/');

const tradeForm = document.getElementById('tradeForm');
const tradesTableBody = document.getElementById('tradesTableBody');
const statusMessage = document.getElementById('statusMessage');

tradeForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(tradeForm);
  const tradeData = {
    stockName: String(formData.get('stockName') || '').trim(),
    buyPrice: Number(formData.get('buyPrice')),
    quantity: Number(formData.get('quantity')),
    stopLoss: Number(formData.get('stopLoss')),
    target: Number(formData.get('target')),
    date: String(formData.get('date') || '').trim(),
  };

  await saveTrade(tradeData);
  tradeForm.reset();
  await loadTrades();
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadTrades();
});

function showMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', isError);
}

function isTradeValid(tradeData) {
  return (
    tradeData.stockName &&
    Number.isFinite(tradeData.buyPrice) &&
    Number.isFinite(tradeData.quantity) &&
    Number.isFinite(tradeData.stopLoss) &&
    Number.isFinite(tradeData.target) &&
    tradeData.date
  );
}

export async function saveTrade(tradeData) {
  if (!isTradeValid(tradeData)) {
    showMessage('Invalid trade data. Please fill all fields correctly.', true);
    return;
  }

  try {
    const newTradeRef = push(tradesRef);
    await set(newTradeRef, tradeData);
    showMessage('Trade saved successfully.');
  } catch (error) {
    console.error('saveTrade error:', error);
    showMessage('Failed to save trade.', true);
  }
}

export async function loadTrades() {
  try {
    const snapshot = await get(tradesRef);
    const data = snapshot.exists() ? snapshot.val() : {};
    renderTrades(data);
    showMessage('Trades loaded.');
  } catch (error) {
    console.error('loadTrades error:', error);
    showMessage('Failed to load trades.', true);
  }
}

export async function deleteTrade(id) {
  if (!id) return;

  try {
    const tradeRef = ref(db, `trades/${id}`);
    await remove(tradeRef);
    showMessage('Trade deleted.');
    await loadTrades();
  } catch (error) {
    console.error('deleteTrade error:', error);
    showMessage('Failed to delete trade.', true);
  }
}

function renderTrades(tradesObject) {
  tradesTableBody.innerHTML = '';

  const entries = Object.entries(tradesObject);
  if (!entries.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="7">No trades found.</td>';
    tradesTableBody.appendChild(row);
    return;
  }

  for (const [id, trade] of entries) {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${escapeHtml(trade.stockName)}</td>
      <td>${formatNumber(trade.buyPrice)}</td>
      <td>${formatNumber(trade.quantity)}</td>
      <td>${formatNumber(trade.stopLoss)}</td>
      <td>${formatNumber(trade.target)}</td>
      <td>${escapeHtml(trade.date)}</td>
      <td><button class="btn-danger" data-id="${id}">Delete</button></td>
    `;

    const deleteButton = row.querySelector('button[data-id]');
    deleteButton.addEventListener('click', async () => {
      await deleteTrade(id);
    });

    tradesTableBody.appendChild(row);
  }
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '-';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
