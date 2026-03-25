import { saveData, subscribeData } from './firebase-db.js';

const MIN_DATE = new Date('2026-03-25T00:00:00');
const today = stripTime(new Date());
let currentDate = new Date(today);
if (currentDate < MIN_DATE) currentDate = new Date(MIN_DATE);

const dateNode = document.getElementById('journalDate');
const datePicker = document.getElementById('journalDatePicker');
const textNode = document.getElementById('journalText');
const savedNode = document.getElementById('journalSaved');
const prevBtn = document.getElementById('prevDay');
const nextBtn = document.getElementById('nextDay');
let timer;
let store = {};

subscribeData('journal', (data) => {
  store = data || {};
  ensureEntry(currentDate);
  render();
});

initPicker();
bindEvents();

function bindEvents() {
  textNode.addEventListener('input', () => {
    const key = dateKey(currentDate);
    store[key] = textNode.value;
    showSaving();
    saveData('journal', store).then(() => showSaved());
  });

  prevBtn.addEventListener('click', () => shiftDay(-1));
  nextBtn.addEventListener('click', () => shiftDay(1));
  datePicker.addEventListener('change', () => {
    const value = datePicker.value;
    if (!value) return;
    const picked = stripTime(new Date(value));
    if (picked < MIN_DATE || picked > today) return;
    currentDate = picked;
    ensureEntry(currentDate);
    render();
  });
}

function render() {
  const key = dateKey(currentDate);
  dateNode.textContent = currentDate.toDateString();
  datePicker.value = toInputDate(currentDate);
  textNode.value = store[key] || '';
}

function shiftDay(delta) {
  const next = new Date(currentDate);
  next.setDate(next.getDate() + delta);
  if (next < MIN_DATE || next > today) return;
  currentDate = stripTime(next);
  ensureEntry(currentDate);
  render();
}

function ensureEntry(d) {
  const key = dateKey(d);
  if (store[key] === undefined) store[key] = '';
}

function initPicker() {
  datePicker.min = toInputDate(MIN_DATE);
  datePicker.max = toInputDate(today);
}

function showSaving() {
  clearTimeout(timer);
  savedNode.textContent = 'Saving...';
}

function showSaved() {
  clearTimeout(timer);
  timer = setTimeout(() => (savedNode.textContent = 'Saved ✓'), 350);
}

function dateKey(d) { return toInputDate(d); }
function toInputDate(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function stripTime(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
