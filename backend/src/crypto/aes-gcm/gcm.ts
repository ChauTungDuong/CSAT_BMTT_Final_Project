import { expandKey256, encryptBlock } from './aes-core';
import { ghash } from './ghash';

// GCM Mode Implementation

function inc32(block: Uint8Array): void {
  // Increment the rightmost 32 bits of the block as a big-endian integer
  for (let i = 15; i >= 12; i--) {
    if (block[i] === 255) {
      block[i] = 0;
    } else {
      block[i]++;
      break;
    }
  }
}

/**
 * Encrypts data using AES-256-GCM
 * @param key 32-byte Uint8Array
 * @param iv 12-byte Uint8Array (96 bits recommended by NIST)
 * @param plaintext The data to encrypt
 * @param aad Additional authenticated data (optional)
 * @returns { ciphertext: Uint8Array, authTag: Uint8Array }
 */
export function encryptGCM(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array = new Uint8Array(0),
): { ciphertext: Uint8Array; authTag: Uint8Array } {
  if (key.length !== 32) throw new Error('Key must be 32 bytes for AES-256');
  if (iv.length !== 12) throw new Error('IV strictly expected to be 12 bytes');

  const w = expandKey256(key);

  // 1. Generate Auth Key H = E(K, 0^128)
  const h = new Uint8Array(16);
  encryptBlock(h, w);

  // 2. Compute J0 = IV || 0^31 || 1
  const j0 = new Uint8Array(16);
  j0.set(iv, 0);
  j0[15] = 1;

  // 3. CTR mode encryption
  // CB1 = inc32(J0)
  const cb = new Uint8Array(16);
  cb.set(j0);
  inc32(cb);

  const ciphertext = new Uint8Array(plaintext.length);
  const block = new Uint8Array(16);

  let offset = 0;
  while (offset < plaintext.length) {
    // block = E(K, CB)
    block.set(cb);
    encryptBlock(block, w);

    // XOR plaintext with encrypted counter
    const len = Math.min(16, plaintext.length - offset);
    for (let i = 0; i < len; i++) {
      ciphertext[offset + i] = plaintext[offset + i] ^ block[i];
    }

    inc32(cb);
    offset += 16;
  }

  // 4. Compute Auth Tag
  // S = GHASH(H, AAD, C)
  const s = ghash(h, aad, ciphertext);

  // E(K, J0)
  const eK_J0 = new Uint8Array(16);
  eK_J0.set(j0);
  encryptBlock(eK_J0, w);

  // Tag = S ^ E(K, J0)
  const authTag = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    authTag[i] = s[i] ^ eK_J0[i];
  }

  return { ciphertext, authTag };
}

/**
 * Decrypts data using AES-256-GCM
 * @param key 32-byte Uint8Array
 * @param iv 12-byte Uint8Array
 * @param ciphertext The encrypted data
 * @param authTag 16-byte authentication tag
 * @param aad Additional authenticated data (optional)
 * @returns plaintext as Uint8Array, or throws an error if authentication fails
 */
export function decryptGCM(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  authTag: Uint8Array,
  aad: Uint8Array = new Uint8Array(0),
): Uint8Array {
  if (key.length !== 32) throw new Error('Key must be 32 bytes for AES-256');
  if (iv.length !== 12) throw new Error('IV strictly expected to be 12 bytes');
  if (authTag.length !== 16)
    throw new Error('AuthTag strictly expected to be 16 bytes');

  const w = expandKey256(key);

  // 1. Generate Auth Key H = E(K, 0^128)
  const h = new Uint8Array(16);
  encryptBlock(h, w);

  // 2. Compute J0 = IV || 0^31 || 1
  const j0 = new Uint8Array(16);
  j0.set(iv, 0);
  j0[15] = 1;

  // 3. Verify Auth Tag First
  // S = GHASH(H, AAD, C)
  const s = ghash(h, aad, ciphertext);

  // E(K, J0)
  const eK_J0 = new Uint8Array(16);
  eK_J0.set(j0);
  encryptBlock(eK_J0, w);

  // Expected Tag = S ^ E(K, J0)
  const expectedTag = new Uint8Array(16);
  let isValid = true;
  for (let i = 0; i < 16; i++) {
    expectedTag[i] = s[i] ^ eK_J0[i];
    // Constant time comparison
    if (expectedTag[i] !== authTag[i]) {
      isValid = false;
    }
  }

  if (!isValid) {
    throw new Error('Unsupported state or invalid authentication tag');
  }

  // 4. CTR mode decryption (which is identical to encryption)
  // CB1 = inc32(J0)
  const cb = new Uint8Array(16);
  cb.set(j0);
  inc32(cb);

  const plaintext = new Uint8Array(ciphertext.length);
  const block = new Uint8Array(16);

  let offset = 0;
  while (offset < ciphertext.length) {
    // block = E(K, CB)
    block.set(cb);
    encryptBlock(block, w);

    // XOR ciphertext with encrypted counter
    const len = Math.min(16, ciphertext.length - offset);
    for (let i = 0; i < len; i++) {
      plaintext[offset + i] = ciphertext[offset + i] ^ block[i];
    }

    inc32(cb);
    offset += 16;
  }

  return plaintext;
}
