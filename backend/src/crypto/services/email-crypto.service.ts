import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { decryptGCM, encryptGCM } from '../aes-gcm';

@Injectable()
export class EmailCryptoService {
  private readonly encryptionKey: Buffer;
  private readonly hashKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const encryptionKeyHex = config.getOrThrow<string>('AES_MASTER_KEY').trim();
    if (encryptionKeyHex.length !== 64) {
      throw new Error('AES_MASTER_KEY phải là 64 hex chars (32 bytes)');
    }

    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');

    const hashKeyHex = (config.get<string>('EMAIL_HASH_KEY') || encryptionKeyHex)
      .trim()
      .toLowerCase();
    if (hashKeyHex.length !== 64) {
      throw new Error('EMAIL_HASH_KEY phải là 64 hex chars (32 bytes)');
    }
    this.hashKey = Buffer.from(hashKeyHex, 'hex');
  }

  normalizeEmail(raw: string): string {
    return (raw || '').trim().toLowerCase();
  }

  hashEmail(raw: string): string {
    const normalized = this.normalizeEmail(raw);
    return crypto
      .createHmac('sha256', this.hashKey)
      .update(normalized, 'utf8')
      .digest('hex');
  }

  encryptEmail(raw: string): Buffer {
    const normalized = this.normalizeEmail(raw);
    const iv = crypto.randomBytes(12);
    const { ciphertext, authTag } = encryptGCM(
      this.encryptionKey,
      iv,
      Buffer.from(normalized, 'utf8'),
    );

    return Buffer.from(
      JSON.stringify({
        type: 'encrypted',
        algo: 'aes-256-gcm',
        payload: Buffer.from(ciphertext).toString('base64'),
        iv: Buffer.from(iv).toString('base64'),
        tag: Buffer.from(authTag).toString('base64'),
      }),
      'utf8',
    );
  }

  decryptEmail(data: Buffer | null | undefined): string | null {
    if (!data) return null;
    try {
      const decoded = JSON.parse(data.toString('utf8')) as {
        payload: string;
        iv: string;
        tag: string;
      };

      const plain = decryptGCM(
        this.encryptionKey,
        Buffer.from(decoded.iv, 'base64'),
        Buffer.from(decoded.payload, 'base64'),
        Buffer.from(decoded.tag, 'base64'),
      );
      return Buffer.from(plain).toString('utf8');
    } catch {
      return null;
    }
  }

  readEmail(encrypted: Buffer | null | undefined): string {
    const decrypted = this.decryptEmail(encrypted);
    return decrypted ? this.normalizeEmail(decrypted) : '';
  }
}
