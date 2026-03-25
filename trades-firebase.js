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

const app = initializeApp(firebaseConfig, 'tradeCrudApp');
const db = getDatabase(app);
const tradesRef = ref(db, 'tradeRecords');

const tradeForm = document.getElementById('tradeForm');
const tradesTableBody = document.getElementById('tradesTableBody');
const statusMessage = document.getElementById('statusMessage');

if (tradeForm && tradesTableBody && statusMessage) {
  tradeForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(tradeForm);
    const recordType = String(formData.get('recordType') || '').trim();
    const tradeData = {
      recordType,
      stockName: String(formData.get('stockName') || '').trim(),
      buyPrice: Number(formData.get('buyPrice')),
      quantity: Number(formData.get('quantity')),
      stopLoss: Number(formData.get('stopLoss')),
      target: Number(formData.get('target')),
      date: String(formData.get('date') || '').trim(),
      journalNote: String(formData.get('journalNote') || '').trim(),
      soldPrice: Number(formData.get('soldPrice')),
      holdingDays: Number(formData.get('holdingDays')),
    };

    await saveTrade(tradeData);
    tradeForm.reset();
    await loadTrades();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    await loadTrades();
  });
}

function showMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('value-loss', isError);
  statusMessage.classList.toggle('value-profit', !isError);
}

function isTradeValid(tradeData) {
  const baseValid = (
    tradeData.recordType
    && tradeData.stockName
    && Number.isFinite(tradeData.buyPrice)
    && Number.isFinite(tradeData.quantity)
    && Number.isFinite(tradeData.stopLoss)
    && Number.isFinite(tradeData.target)
    && tradeData.date
  );
  if (!baseValid) return false;

  if (tradeData.recordType === 'journal' && !tradeData.journalNote) return false;
  if (tradeData.recordType === 'pasttrades') {
    return Number.isFinite(tradeData.soldPrice) && Number.isFinite(tradeData.holdingDays);
  }
  return true;
}

export async function saveTrade(tradeData) {
  if (!isTradeValid(tradeData)) {
    showMessage('Invalid data. Fill all required fields for the selected record type.', true);
    return;
  }

  try {
    const newTradeRef = push(tradesRef);
    await set(newTradeRef, sanitizeTrade(tradeData));
    showMessage('Record saved to Firebase.');
  } catch (error) {
    console.error('saveTrade error:', error);
    showMessage('Failed to save record.', true);
  }
}

export async function loadTrades() {
  try {
    const snapshot = await get(tradesRef);
    const data = snapshot.exists() ? snapshot.val() : {};
    renderTrades(data);
    showMessage('Records loaded from Firebase.');
  } catch (error) {
    console.error('loadTrades error:', error);
    showMessage('Failed to load records.', true);
  }
}

export async function deleteTrade(id) {
  if (!id) return;

  try {
    const tradeRef = ref(db, `tradeRecords/${id}`);
    await remove(tradeRef);
    showMessage('Record deleted.');
    await loadTrades();
  } catch (error) {
    console.error('deleteTrade error:', error);
    showMessage('Failed to delete record.', true);
  }
}

function sanitizeTrade(tradeData) {
  return {
    recordType: tradeData.recordType,
    stockName: tradeData.stockName,
    buyPrice: tradeData.buyPrice,
    quantity: tradeData.quantity,
    stopLoss: tradeData.stopLoss,
    target: tradeData.target,
    date: tradeData.date,
    journalNote: tradeData.recordType === 'journal' ? tradeData.journalNote : '',
    soldPrice: tradeData.recordType === 'pasttrades' ? tradeData.soldPrice : null,
    holdingDays: tradeData.recordType === 'pasttrades' ? tradeData.holdingDays : null,
  };
}

function renderTrades(tradesObject) {
  tradesTableBody.innerHTML = '';

  const entries = Object.entries(tradesObject);
  if (!entries.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="11">No records found.</td>';
    tradesTableBody.appendChild(row);
    return;
  }

  for (const [id, trade] of entries) {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${escapeHtml(trade.recordType)}</td>
      <td>${escapeHtml(trade.stockName)}</td>
      <td>${formatNumber(trade.buyPrice)}</td>
      <td>${formatNumber(trade.quantity)}</td>
      <td>${formatNumber(trade.stopLoss)}</td>
      <td>${formatNumber(trade.target)}</td>
      <td>${escapeHtml(trade.date)}</td>
      <td>${escapeHtml(trade.journalNote || '-')}</td>
      <td>${trade.soldPrice == null ? '-' : formatNumber(trade.soldPrice)}</td>
      <td>${trade.holdingDays == null ? '-' : formatNumber(trade.holdingDays)}</td>
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
