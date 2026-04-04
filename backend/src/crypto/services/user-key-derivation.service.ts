import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Pbkdf2Service } from './pbkdf2.service';

@Injectable()
export class UserKeyDerivationService {
  private readonly defaultIterations = 310000;
  private readonly defaultKeyLength = 32;

  constructor(private readonly pbkdf2: Pbkdf2Service) {}

  generateSaltHex(size = 16): string {
    return crypto.randomBytes(size).toString('hex');
  }

  deriveKek(
    password: string,
    saltHex: string,
    iterations = this.defaultIterations,
    keyLength = this.defaultKeyLength,
  ): Buffer {
    return this.pbkdf2.deriveKey(password, saltHex, iterations, keyLength);
  }
}
