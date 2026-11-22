// base32.js: turns a Base32 secret key into bytes, and makes new random keys.
// Authenticator secrets are written in Base32: only A–Z and 2–7, so they're easy to read
// out and type. Each character holds 5 bits, so 8 characters make exactly 5 bytes.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// People paste keys with spaces, dashes, lowercase letters or "=" padding. None of that matters.
export function cleanKey(text) {
  return text.toUpperCase().replace(/[\s=-]/g, '');
}

export function base32Decode(text) {
  const bytes = [];
  let bits = 0; // bits we have collected but not turned into a byte yet
  let bitCount = 0; // how many of those bits there are

  for (const char of cleanKey(text)) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error(`"${char}" can't be in a secret key. Use only the letters A–Z and the digits 2–7.`);
    }
    bits = (bits << 5) | value;
    bitCount += 5;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 0xff);
      bits = bits & ((1 << bitCount) - 1); // keep only the bits we haven't used yet
    }
  }
  return new Uint8Array(bytes);
}

// A new key: 32 random Base32 characters. That's 160 bits, the size RFC 4226 recommends.
export function randomSecret() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  let secret = '';
  for (const byte of randomBytes) {
    secret += ALPHABET[byte % 32]; // 256 is a multiple of 32, so every character is equally likely
  }
  return secret;
}
