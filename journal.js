// journal.js
const journalKey = 'journal';

function loadJournal() {
  let journalData = JSON.parse(localStorage.getItem(journalKey) || '{}');
  const container = document.getElementById('journal-container');
  container.innerHTML = '';

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (!journalData[todayStr]) {
    journalData[todayStr] = '';
  }

  // Auto-create today's journal if not exists
  if (!journalData[todayStr]) {
    journalData[todayStr] = '';
  }

  const dateHeader = document.createElement('h2');
  dateHeader.textContent = formatDate(today);
  container.appendChild(dateHeader);

  const textarea = document.createElement('textarea');
  textarea.style.width = '100%';
  textarea.style.height = '300px';
  textarea.value = journalData[todayStr];
  textarea.addEventListener('input', () => {
    journalData[todayStr] = textarea.value;
    localStorage.setItem(journalKey, JSON.stringify(journalData));
  });
  container.appendChild(textarea);

  // Navigation for past dates
  const navDiv = document.createElement('div');
  navDiv.style.marginTop = '10px';

  const backBtn = document.createElement('button');
  backBtn.textContent = 'Back';
  backBtn.onclick = () => {
    const prevDate = new Date(today);
    prevDate.setDate(prevDate.getDate() - 1);
    loadJournalForDate(prevDate);
  };
  navDiv.appendChild(backBtn);

  // No forward beyond today
  container.appendChild(navDiv);
}

function loadJournalForDate(date) {
  const journalData = JSON.parse(localStorage.getItem(journalKey) || '{}');
  const dateStr = date.toISOString().split('T')[0];
  const container = document.getElementById('journal-container');
  container.innerHTML = '';

  const dateHeader = document.createElement('h2');
  dateHeader.textContent = formatDate(date);
  container.appendChild(dateHeader);

  const textarea = document.createElement('textarea');
  textarea.style.width = '100%';
  textarea.style.height = '300px';
  textarea.value = journalData[dateStr] || '';
  textarea.addEventListener('input', () => {
    journalData[dateStr] = textarea.value;
    localStorage.setItem(journalKey, JSON.stringify(journalData));
  });
  container.appendChild(textarea);

  // Navigation
  const navDiv = document.createElement('div');
  navDiv.style.marginTop = '10px';

  const backBtn = document.createElement('button');
  backBtn.textContent = 'Back';
  backBtn.onclick = () => {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    loadJournalForDate(prevDate);
  };
  navDiv.appendChild(backBtn);

  // No forward beyond today
  container.appendChild(navDiv);
}

function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}

document.addEventListener('DOMContentLoaded', loadJournal);
