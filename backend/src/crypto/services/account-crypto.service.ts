import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AesService } from './aes.service';

/**
 * Service để mã hóa và hash số tài khoản.
 * - Hash: dùng để tìm kiếm/unique constraint (không giải mã được)
 * - Encrypt: dùng để lưu số tài khoản an toàn
 */
@Injectable()
export class AccountCryptoService {
  private readonly logger = new Logger(AccountCryptoService.name);
  private readonly hmacKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly aes: AesService,
  ) {
    // Dùng AES master key để derive HMAC key (hoặc có thể generate riêng)
    const keyHex = config.getOrThrow<string>('AES_MASTER_KEY');
    this.hmacKey = Buffer.from(keyHex, 'hex');
  }

  /**
   * Tính HMAC-SHA256 của accountNumber cho tìm kiếm/unique constraint
   * @param accountNumber Số tài khoản dạng plaintext
   * @returns HMAC hash hex string (64 chars)
   */
  hashAccountNumber(accountNumber: string): string {
    const normalized = accountNumber.trim();
    const hash = crypto
      .createHmac('sha256', this.hmacKey)
      .update(normalized)
      .digest('hex');
    return hash;
  }

  /**
   * Mã hóa số tài khoản bằng AES-256-GCM
   * @param accountNumber Số tài khoản plaintext
   * @returns EncryptedCell object (dạng serialize được)
   */
  async encryptAccountNumber(accountNumber: string) {
    const normalized = accountNumber.trim();
    return await this.aes.encrypt(normalized);
  }

  /**
   * Giải mã số tài khoản
   * @param encrypted EncryptedCell object (dạng từ DB)
   * @returns plaintext accountNumber
   */
  async decryptAccountNumber(encrypted: any): Promise<string | null> {
    return await this.aes.decrypt(encrypted);
  }
}
