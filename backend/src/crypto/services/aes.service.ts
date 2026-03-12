import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  CellValue,
  EncryptedCell,
  ICryptoService,
} from '../interfaces/crypto.interface';

@Injectable()
export class AesService implements ICryptoService {
  private readonly logger = new Logger(AesService.name);
  private readonly masterKey: Buffer;
  private readonly hmacSecret: Buffer;

  constructor(private readonly config: ConfigService) {
    const keyHex = config.getOrThrow<string>('AES_MASTER_KEY');
    const hmacHex = config.getOrThrow<string>('HMAC_SECRET');

    if (keyHex.length !== 64)
      throw new Error('AES_MASTER_KEY phải là 64 hex chars (32 bytes)');
    if (hmacHex.length !== 64)
      throw new Error('HMAC_SECRET phải là 64 hex chars (32 bytes)');

    this.masterKey = Buffer.from(keyHex, 'hex');
    this.hmacSecret = Buffer.from(hmacHex, 'hex');
  }

  async encrypt(plaintext: string): Promise<CellValue> {
    // IV ngẫu nhiên mỗi lần — BẮT BUỘC
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag(); // 16 bytes authentication tag

    const payloadB64 = ciphertext.toString('base64');
    const ivB64 = iv.toString('base64');
    const tagB64 = tag.toString('base64');

    // HMAC trên toàn bộ ciphertext + IV + tag để detect tampering
    const hmac = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(`${payloadB64}.${ivB64}.${tagB64}`)
      .digest('hex');

    return {
      type: 'encrypted',
      algo: 'aes-256-gcm',
      payload: payloadB64,
      iv: ivB64,
      tag: tagB64,
      hmac,
    } as EncryptedCell;
  }

  async decrypt(cell: CellValue): Promise<string | null> {
    if (cell.type === 'clear') return cell.data;

    const enc = cell as EncryptedCell;

    // 1. Verify HMAC trước khi decrypt
    const expectedHmac = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(`${enc.payload}.${enc.iv}.${enc.tag}`)
      .digest('hex');

    if (expectedHmac !== enc.hmac) {
      this.logger.error('HMAC mismatch — dữ liệu có thể bị giả mạo');
      return null; // KHÔNG throw để tránh timing attack
    }

    // 2. Decrypt
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        Buffer.from(enc.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(enc.payload, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      this.logger.error('AES-GCM decrypt thất bại — auth tag không khớp');
      return null;
    }
  }

  serialize(cell: CellValue): Buffer {
    return Buffer.from(JSON.stringify(cell), 'utf8');
  }

  deserialize(data: Buffer | null): CellValue {
    if (!data) return { type: 'clear', data: '' };
    try {
      // Oracle trả về LOB object hoặc Buffer
      const str = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      return JSON.parse(str) as CellValue;
    } catch {
      return { type: 'clear', data: '' };
    }
  }

  // Helper: đọc Oracle LOB → Buffer
  async readOracleLob(lob: any): Promise<Buffer | null> {
    if (!lob) return null;
    if (Buffer.isBuffer(lob)) return lob;
    if (typeof lob.getData === 'function') {
      const data = await lob.getData();
      return Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    }
    return Buffer.from(String(lob), 'utf8');
  }
}
