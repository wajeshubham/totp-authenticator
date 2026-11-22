// totp.js: makes the 6-digit codes. HOTP (RFC 4226) turns a secret + a counter into a code;
// TOTP (RFC 6238) is HOTP where the counter is "which 30-second window are we in".
// It only uses Web Crypto, which is built into every modern browser.

export const PERIOD = 30; // a new code every 30 seconds

export async function hotp(secretBytes, counter) {
  // Step 1: the counter as 8 bytes. It fits in the last 4 until the year 6053, so the first 4 stay 0.
  const counterBytes = new Uint8Array(8);
  new DataView(counterBytes.buffer).setUint32(4, counter);

  // Step 2: HMAC-SHA1 of the counter, with the secret as the key. The result is always 20 bytes.
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));

  // Step 3, "dynamic truncation": the low 4 bits of the last byte say where to start reading (0–15).
  const offset = hmac[19] & 0x0f;

  // Step 4: read 4 bytes from there as one number. "& 0x7f" clears the top bit so it's never negative.
  const num =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];

  // Step 5: keep the last 6 digits, and put back any leading zeros ("42" → "000042").
  return String(num % 1_000_000).padStart(6, '0');
}

export function totp(secretBytes, unixSeconds = Date.now() / 1000) {
  return hotp(secretBytes, Math.floor(unixSeconds / PERIOD));
}

// Seconds until the code changes: 30 right after a change, 1 just before the next one.
export function secondsRemaining(unixSeconds = Date.now() / 1000) {
  return PERIOD - (Math.floor(unixSeconds) % PERIOD);
}

// What a server does when you log in. Clocks drift and people type slowly, so it also accepts
// the codes from the window before and the window after. `drift` says which one matched.
// (Real servers also compare in constant time and refuse a code that was already used.)
export async function verifyTotp(secretBytes, code, unixSeconds = Date.now() / 1000) {
  for (const drift of [-1, 0, 1]) {
    if ((await totp(secretBytes, unixSeconds + drift * PERIOD)) === code) {
      return { valid: true, drift };
    }
  }
  return { valid: false };
}
