import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  CellValue,
  EncryptedCell,
  ICryptoService,
} from '../interfaces/crypto.interface';
import { encryptGCM, decryptGCM } from '../aes-gcm';
import { CryptoLogService } from './crypto-log.service';
import { CryptoTraceContextService } from './crypto-trace-context.service';

@Injectable()
export class AesService implements ICryptoService {
  private readonly logger = new Logger(AesService.name);
  private readonly masterKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly cryptoLog: CryptoLogService,
    private readonly traceContext: CryptoTraceContextService,
  ) {
    const keyHex = config.getOrThrow<string>('AES_MASTER_KEY');

    if (keyHex.length !== 64)
      throw new Error('AES_MASTER_KEY phải là 64 hex chars (32 bytes)');

    this.masterKey = Buffer.from(keyHex, 'hex');
  }

  async encrypt(plaintext: string): Promise<CellValue> {
    const actionId = this.traceContext.getActionId() ?? crypto.randomUUID();
    const actionName = this.traceContext.getActionName() ?? 'SYSTEM';
    const userId = this.traceContext.getUserId();
    const keySnippet = this.masterKey.slice(0, 4).toString('hex') + '...';

    // IV ngẫu nhiên mỗi lần — BẮT BUỘC 12 bytes cho GCM
    const iv = crypto.randomBytes(12);
    const ivB64 = iv.toString('base64');

    // Log: input plaintext
    this.cryptoLog.addLog({
      actionId,
      userId,
      actionName,
      operation: 'encrypt',
      layer: 'AES-256',
      input: plaintext,
      output: plaintext,
      iv: ivB64,
      keySnippet,
      status: 'success',
    });

    // Sử dụng AES-GCM TypeScript thuần túy
    const plainBytes = Buffer.from(plaintext, 'utf8');
    const { ciphertext, authTag } = encryptGCM(this.masterKey, iv, plainBytes);

    const payloadB64 = Buffer.from(ciphertext).toString('base64');
    const tagB64 = Buffer.from(authTag).toString('base64');

    // Log: AES encryption output
    this.cryptoLog.addLog({
      actionId,
      userId,
      actionName,
      operation: 'encrypt',
      layer: 'AES-256',
      input: plaintext,
      output: payloadB64,
      iv: ivB64,
      tag: tagB64,
      keySnippet,
      status: 'success',
    });

    const cell = {
      type: 'encrypted',
      algo: 'aes-256-gcm',
      payload: payloadB64,
      iv: ivB64,
      tag: tagB64,
    } as EncryptedCell;

    return cell;
  }

  async decrypt(cell: CellValue): Promise<string | null> {
    if (cell.type === 'clear') return cell.data;

    const actionId = this.traceContext.getActionId() ?? crypto.randomUUID();
    const actionName = this.traceContext.getActionName() ?? 'SYSTEM';
    const userId = this.traceContext.getUserId();
    const keySnippet = this.masterKey.slice(0, 4).toString('hex') + '...';

    const enc = cell as EncryptedCell;

    // Log: input encrypted
    this.cryptoLog.addLog({
      actionId,
      userId,
      actionName,
      operation: 'decrypt',
      layer: 'AES-256',
      input: enc.payload,
      output: enc.payload,
      iv: enc.iv,
      tag: enc.tag,
      keySnippet,
      status: 'success',
    });

    // Decrypt bằng AES-GCM TypeScript thuần túy
    try {
      const plaintextBytes = decryptGCM(
        this.masterKey,
        Buffer.from(enc.iv, 'base64'),
        Buffer.from(enc.payload, 'base64'),
        Buffer.from(enc.tag, 'base64'),
      );

      const plaintext = Buffer.from(plaintextBytes).toString('utf8');

      // Log: decryption output
      this.cryptoLog.addLog({
        actionId,
        userId,
        actionName,
        operation: 'decrypt',
        layer: 'AES-256',
        input: enc.payload,
        output: plaintext,
        iv: enc.iv,
        tag: enc.tag,
        keySnippet,
        status: 'success',
      });

      return plaintext;
    } catch (err) {
      this.logger.error('AES-GCM decrypt thất bại — auth tag không khớp');
      this.cryptoLog.addLog({
        actionId,
        userId,
        actionName,
        operation: 'decrypt',
        layer: 'AES-256',
        input: enc.payload,
        output: '',
        iv: enc.iv,
        tag: enc.tag,
        keySnippet,
        status: 'failure',
      });
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
