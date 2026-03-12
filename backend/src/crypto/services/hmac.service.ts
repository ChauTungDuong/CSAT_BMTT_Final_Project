import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class HmacService {
  private readonly secret: Buffer;

  constructor(private readonly config: ConfigService) {
    const hex = config.getOrThrow<string>('HMAC_SECRET');
    this.secret = Buffer.from(hex, 'hex');
  }

  sign(data: string): string {
    return crypto.createHmac('sha256', this.secret).update(data).digest('hex');
  }

  verify(data: string, signature: string): boolean {
    const expected = this.sign(data);
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }
}
