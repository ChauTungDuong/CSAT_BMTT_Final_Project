import * as crypto from 'crypto';
import { encryptGCM, decryptGCM } from './index';

describe('Pure TypeScript AES-256-GCM', () => {
  it('should encrypt and decrypt mathematically matching Node standard crypto', () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const plaintext = Buffer.from('Hello World Secret Data Authentication!!', 'utf8');

    // 1. Encrypt with Node standard library
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const nodeCiphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const nodeAuthTag = cipher.getAuthTag();

    // 2. Encrypt with Pure TS implementation
    const { ciphertext: tsCiphertext, authTag: tsAuthTag } = encryptGCM(key, iv, plaintext);

    // Assert Ciphertext matches perfectly
    expect(Buffer.from(tsCiphertext).equals(nodeCiphertext)).toBe(true);
    // Assert AuthTag matches perfectly
    expect(Buffer.from(tsAuthTag).equals(nodeAuthTag)).toBe(true);

    // 3. Decrypt with Pure TS implementation
    const tsDecrypted = decryptGCM(key, iv, Math.random() > 0.5 ? nodeCiphertext : tsCiphertext, tsAuthTag);
    expect(Buffer.from(tsDecrypted).toString('utf8')).toEqual('Hello World Secret Data Authentication!!');
  });

  it('should throw an error on invalid auth tag during decryption', () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const plaintext = Buffer.from('Important Data', 'utf8');

    const { ciphertext, authTag } = encryptGCM(key, iv, plaintext);

    // Tamper with the tag
    authTag[0] ^= 1;

    expect(() => {
      decryptGCM(key, iv, ciphertext, authTag);
    }).toThrow(/invalid authentication tag/i);
  });
});
