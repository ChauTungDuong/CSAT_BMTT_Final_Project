import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CellValue,
  EncryptedCell,
  ICryptoService,
} from '../interfaces/crypto.interface';
import { encryptGCM, decryptGCM } from '../aes-gcm';
import { CryptoTraceContextService } from './crypto-trace-context.service';
import { UserDekRuntimeService } from './user-dek-runtime.service';

@Injectable()
export class AesService implements ICryptoService {
  private readonly logger = new Logger(AesService.name);

  constructor(
    private readonly traceContext: CryptoTraceContextService,
    private readonly userDekRuntime: UserDekRuntimeService,
  ) {}

  async encrypt(plaintext: string): Promise<CellValue> {
    const traceUserId = this.traceContext.getUserId();
    if (!traceUserId || traceUserId === 'anonymous') {
      throw new Error(
        'Thiếu user context để mã hóa dữ liệu nhạy cảm (master key fallback đã bị tắt)',
      );
    }
    return this.encryptForUser(traceUserId, plaintext);
  }

  async encryptForUser(userId: string, plaintext: string): Promise<CellValue> {
    const userDek = this.userDekRuntime.getUserDek(userId);
    if (!userDek) {
      throw new Error(
        'Không có user DEK runtime để mã hóa (master key fallback đã bị tắt)',
      );
    }
    return this.encryptWithKey(userDek, plaintext);
  }

  private async encryptWithKey(
    key: Buffer,
    plaintext: string,
  ): Promise<CellValue> {
    // IV ngẫu nhiên mỗi lần — BẮT BUỘC 12 bytes cho GCM
    const iv = crypto.randomBytes(12);
    const ivB64 = iv.toString('base64');

    // Sử dụng AES-GCM TypeScript thuần túy
    const plainBytes = Buffer.from(plaintext, 'utf8');
    const { ciphertext, authTag } = encryptGCM(key, iv, plainBytes);

    const payloadB64 = Buffer.from(ciphertext).toString('base64');
    const tagB64 = Buffer.from(authTag).toString('base64');

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

    const traceUserId = this.traceContext.getUserId();
    if (!traceUserId || traceUserId === 'anonymous') {
      throw new Error(
        'Thiếu user context để giải mã dữ liệu nhạy cảm',
      );
    }
    return this.decryptForUser(traceUserId, cell);
  }

  async decryptForUser(
    userId: string,
    cell: CellValue,
  ): Promise<string | null> {
    if (cell.type === 'clear') return cell.data;

    const userDek = this.userDekRuntime.getUserDek(userId);
    if (!userDek) {
      throw new Error(
        'Không có user DEK runtime để giải mã (master key fallback đã bị tắt)',
      );
    }

    return this.decryptWithKey(userDek, cell, false);
  }

  private async decryptWithKey(
    key: Buffer,
    cell: CellValue,
    suppressErrorLog: boolean,
  ): Promise<string | null> {
    const enc = cell as EncryptedCell;

    // Decrypt bằng AES-GCM TypeScript thuần túy
    try {
      const plaintextBytes = decryptGCM(
        key,
        Buffer.from(enc.iv, 'base64'),
        Buffer.from(enc.payload, 'base64'),
        Buffer.from(enc.tag, 'base64'),
      );

      const plaintext = Buffer.from(plaintextBytes).toString('utf8');

      return plaintext;
    } catch (err) {
      if (!suppressErrorLog) {
        this.logger.error('AES-GCM decrypt thất bại — auth tag không khớp');
      }
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
