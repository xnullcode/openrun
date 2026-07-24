// Web Crypto API utility for AES-GCM password encryption/decryption

// Convert a string to an ArrayBuffer
function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Convert an ArrayBuffer to a string
function ab2str(buf: ArrayBuffer) {
  return String.fromCharCode.apply(null, Array.from(new Uint8Array(buf)));
}

// Convert an ArrayBuffer to base64
function ab2b64(buf: ArrayBuffer) {
  return btoa(ab2str(buf));
}

// Convert base64 to an ArrayBuffer
function b642ab(b64: string) {
  return str2ab(atob(b64));
}

// Derive an AES key from a password and salt using PBKDF2
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string using a password.
 * Returns a base64 encoded string containing the salt, iv, and ciphertext.
 */
export async function encryptData(text: string, password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    enc.encode(text)
  );

  // Combine salt, iv, and ciphertext into a single ArrayBuffer
  const ciphertextArr = new Uint8Array(ciphertext);
  const combined = new Uint8Array(salt.length + iv.length + ciphertextArr.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(ciphertextArr, salt.length + iv.length);

  return ab2b64(combined.buffer);
}

/**
 * Decrypt a base64 encoded string using a password.
 * Returns the plaintext string. Throws an error if decryption fails (e.g., wrong password).
 */
export async function decryptData(encryptedBase64: string, password: string): Promise<string> {
  const combined = new Uint8Array(b642ab(encryptedBase64));
  
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const key = await deriveKey(password, salt);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}
