// vault.js: keeps your accounts encrypted in localStorage.
// PBKDF2 slowly stretches your master password into an AES key, and AES-GCM encrypts the
// accounts list with it. Only the salt, the IV and the encrypted bytes are ever stored.

const STORAGE_KEY = 'authenticator-vault';
const ITERATIONS = 600_000; // OWASP's advice for PBKDF2-SHA256: slow for attackers, fine for us

let key = null; // the AES key: only in memory, and gone when the page reloads
let salt = null;

export function vaultExists() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// Same password + same salt = same key. The random salt means attackers can't use
// a table of keys they worked out in advance for common passwords.
async function deriveKey(password, salt) {
  const passwordBytes = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable: even our own code can't read the raw key bytes
    ['encrypt', 'decrypt'],
  );
}

// First visit: a new salt and key, and an empty list of accounts.
export async function createVault(password) {
  salt = crypto.getRandomValues(new Uint8Array(16));
  key = await deriveKey(password, salt);
  await saveVault([]);
  return [];
}

// Returns the saved accounts, or throws "Wrong password".
export async function unlockVault(password) {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  salt = new Uint8Array(stored.salt);
  key = await deriveKey(password, salt);
  try {
    const iv = new Uint8Array(stored.iv);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(stored.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    // AES-GCM checks a built-in tag, so a wrong key fails loudly instead of returning garbage.
    throw new Error('Wrong password');
  }
}

export async function saveVault(accounts) {
  // AES-GCM must never reuse an IV with the same key, so every save gets a fresh random one.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(accounts));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  // localStorage can only hold text, so the bytes are saved as JSON lists of numbers.
  const stored = { salt: Array.from(salt), iv: Array.from(iv), data: Array.from(encrypted) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}
