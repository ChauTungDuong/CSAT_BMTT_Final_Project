import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AesService } from './aes.service';
import { Pbkdf2Service } from './pbkdf2.service';

/**
 * Service để mã hóa và hash số tài khoản.
 * - Hash: dùng để tìm kiếm/unique constraint (không giải mã được)
 * - Encrypt: dùng để lưu số tài khoản an toàn
 */
@Injectable()
export class AccountCryptoService {
  private readonly hmacKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly aes: AesService,
    private readonly pbkdf2: Pbkdf2Service,
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
    return this.pbkdf2.hmacHex(normalized, this.hmacKey);
  }

  async encryptAccountNumberForUser(userId: string, accountNumber: string) {
    const normalized = accountNumber.trim();
    return await this.aes.encryptForUser(userId, normalized);
  }

  async decryptAccountNumberForUser(
    userId: string,
    encrypted: any,
  ): Promise<string | null> {
    return await this.aes.decryptForUser(userId, encrypted);
  }
}
