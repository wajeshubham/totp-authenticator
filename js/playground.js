// playground.js: a tiny "server" for playground.html.
// It shows a random secret key as a setup QR code, like a website does when you turn on 2FA.
// Then it checks the code from your authenticator app the way a website would, with verifyTotp().

import { base32Decode, cleanKey, randomSecret } from './base32.js';
import { verifyTotp } from './totp.js';

const secretInput = document.getElementById('secret-input');
const codeInput = document.getElementById('code-input');
const result = document.getElementById('result');
const qrImage = document.getElementById('qr-code');
const setupLink = document.getElementById('setup-link');

// "GEZDGNBVGY3T" → "GEZD GNBV GY3T", which is much easier to type into a phone.
function groupInFours(text) {
  const groups = [];
  for (let i = 0; i < text.length; i += 4) {
    groups.push(text.slice(i, i + 4));
  }
  return groups.join(' ');
}

// A setup QR code is just an otpauth link drawn as black and white squares.
// qrcode() comes from the qrcode-generator <script> tag in playground.html.
function showQrCode() {
  try {
    const secret = cleanKey(secretInput.value); // no spaces, all uppercase
    base32Decode(secret); // throws for characters that aren't Base32
    if (secret === '') throw new Error('There is no secret key yet.');
    const link = `otpauth://totp/Playground:demo?secret=${secret}&issuer=Playground`;
    const qr = qrcode(0, 'M'); // 0 = the smallest size that fits, 'M' = medium error correction
    qr.addData(link);
    qr.make();
    qrImage.src = qr.createDataURL(6); // an image with 6 pixels per square
    qrImage.hidden = false;
    setupLink.textContent = link;
  } catch {
    // A key with bad characters can't go in a QR code. Pressing Verify says what's wrong.
    qrImage.hidden = true;
    setupLink.textContent = '';
  }
}

// Servers accept the previous, current and next 30-second window, so say which one matched.
function describe(check) {
  if (!check.valid) {
    return "Not valid. The code doesn't match the previous, current or next window.";
  }
  if (check.drift === -1) {
    return 'Valid. The code is from the previous window, which servers still accept because people type slowly.';
  }
  if (check.drift === 1) {
    return "Valid. The code is from the next window, so your phone's clock is a little ahead.";
  }
  return 'Valid. The code matches the current window.';
}

document.getElementById('verify-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const secretBytes = base32Decode(secretInput.value); // throws a friendly error for bad characters
    const check = await verifyTotp(secretBytes, codeInput.value);
    result.textContent = describe(check);
    result.className = check.valid ? 'text-green-700' : 'text-red-600';
  } catch (error) {
    result.textContent = error.message;
    result.className = 'text-red-600';
  }
});

// Editing the key redraws the QR code, so the two always match.
secretInput.addEventListener('input', showQrCode);

// Start with a random secret, so there's always something to scan.
secretInput.value = groupInFours(randomSecret());
showQrCode();
