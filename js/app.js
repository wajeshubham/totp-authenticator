// app.js: the user interface for index.html.
// Shows a live code for every account, adds and deletes accounts, and locks them away.

import { base32Decode, cleanKey } from './base32.js';
import { totp, secondsRemaining, PERIOD } from './totp.js';
import { vaultExists, createVault, unlockVault, saveVault } from './vault.js';

// ===== Account list with live codes =====
const accountList = document.getElementById('account-list');
const accountTemplate = document.getElementById('account-template');
const timerBar = document.getElementById('timer-bar');

let accounts = []; // { name, secret } for each account, filled in when the vault unlocks
let rows = []; // { account, row } for each row on screen, so we know which code goes where

// Draws one row per account. updateCodes() fills in the codes.
function renderAccounts() {
  accountList.replaceChildren();
  rows = [];
  for (const account of accounts) {
    const row = accountTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('.account-name').textContent = account.name;
    row.querySelector('.copy-button').addEventListener('click', () => copyCode(row));
    row.querySelector('.delete-button').addEventListener('click', () => deleteAccount(account));
    accountList.append(row);
    rows.push({ account, row });
  }
  document.getElementById('empty-message').hidden = accounts.length > 0;
  updateCodes();
}

// Runs every second: works out each code, then moves the countdown bar.
async function updateCodes() {
  const now = Date.now() / 1000;
  for (const { account, row } of rows) {
    const code = await totp(base32Decode(account.secret), now);
    row.dataset.code = code;
    row.querySelector('.code').textContent = code.slice(0, 3) + ' ' + code.slice(3);
  }
  const secondsLeft = secondsRemaining(now);
  timerBar.style.width = (secondsLeft / PERIOD) * 100 + '%';
  document.getElementById('timer-text').textContent = secondsLeft + ' s';
  // The bar turns amber in the last 5 seconds. Only one of the two colours is ever on.
  const ending = secondsLeft <= 5;
  timerBar.classList.toggle('bg-amber-500', ending);
  timerBar.classList.toggle('bg-blue-600', !ending);
}

async function copyCode(row) {
  const button = row.querySelector('.copy-button');
  await navigator.clipboard.writeText(row.dataset.code);
  button.textContent = 'Copied!';
  setTimeout(() => {
    button.textContent = 'Copy';
  }, 1000);
}

setInterval(updateCodes, 1000);
renderAccounts();

// ===== Add and delete accounts =====
const addForm = document.getElementById('add-form');
const nameInput = document.getElementById('name-input');
const keyInput = document.getElementById('key-input');
const addError = document.getElementById('add-error');

addForm.addEventListener('submit', async (event) => {
  event.preventDefault(); // stop the browser from reloading the page
  try {
    const secret = cleanKey(keyInput.value); // "jbsw y3dp" → "JBSWY3DP"
    // base32Decode throws a friendly error for characters that aren't Base32.
    if (base32Decode(secret).length < 10) {
      throw new Error('That secret key is too short. Keys are usually 16 or 32 characters.');
    }
    accounts.push({ name: nameInput.value.trim(), secret });
    renderAccounts();
    await saveVault(accounts);
    addForm.reset();
    addError.textContent = '';
  } catch (error) {
    addError.textContent = error.message;
  }
});

async function deleteAccount(account) {
  // confirm() is the simplest "Are you sure?". Deleting a key can lock you out of that website.
  if (!confirm(`Delete ${account.name}? Make sure you can still sign in another way.`)) {
    return;
  }
  accounts = accounts.filter((other) => other !== account);
  renderAccounts();
  await saveVault(accounts);
}

// ===== Lock screen and encrypted vault =====
const app = document.getElementById('app');
const lockForm = document.getElementById('lock-form');
const lockButton = document.getElementById('lock-button');
const passwordInput = document.getElementById('password-input');
const repeatInput = document.getElementById('repeat-input');
const lockError = document.getElementById('lock-error');

// The same form creates the vault on your first visit and unlocks it after that.
const firstVisit = !vaultExists();
document.getElementById('lock-title').textContent = firstVisit ? 'Create a master password' : 'Unlock';
repeatInput.hidden = !firstVisit; // you only type it twice the first time

lockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = passwordInput.value;
  try {
    if (firstVisit && password.length < 8) {
      throw new Error('Use at least 8 characters.');
    }
    if (firstVisit && password !== repeatInput.value) {
      throw new Error("The passwords don't match.");
    }
    accounts = firstVisit ? await createVault(password) : await unlockVault(password);
    lockForm.hidden = true;
    app.hidden = false;
    lockButton.hidden = false;
    renderAccounts();
  } catch (error) {
    lockError.textContent = error.message; // for example "Wrong password"
    passwordInput.select(); // ready to type it again
  }
});

// The key only lives in memory, so reloading the page forgets it and shows the lock screen.
lockButton.addEventListener('click', () => location.reload());
