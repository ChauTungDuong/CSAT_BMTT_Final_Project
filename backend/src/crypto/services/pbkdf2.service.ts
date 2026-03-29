import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { sha256 } from '../pure/rsa-manual';

type HashPurpose = 'password' | 'pin';

@Injectable()
export class Pbkdf2Service {
  private readonly algorithm = 'sha256';
  private readonly formatPrefix = 'pbkdf2';

  hashSecret(secret: string, purpose: HashPurpose): string {
    const iterations = purpose === 'pin' ? 220000 : 310000;
    const dkLen = 32;
    const salt = crypto.randomBytes(16);
    const derived = this.pbkdf2(secret, salt, iterations, dkLen);

    return [
      this.formatPrefix,
      this.algorithm,
      String(iterations),
      salt.toString('hex'),
      derived.toString('hex'),
    ].join('$');
  }

  verifySecret(secret: string, stored: string): boolean {
    const parts = stored.split('$');
    if (parts.length !== 5) return false;

    const [prefix, algorithm, iterRaw, saltHex, hashHex] = parts;
    if (prefix !== this.formatPrefix || algorithm !== this.algorithm) {
      return false;
    }

    const iterations = Number(iterRaw);
    if (!Number.isFinite(iterations) || iterations < 1000) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = this.pbkdf2(secret, salt, iterations, expected.length);

    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  }

  private pbkdf2(
    secret: string,
    salt: Buffer,
    iterations: number,
    dkLen: number,
  ): Buffer {
    const hLen = 32; // sha256 output size
    const l = Math.ceil(dkLen / hLen);
    const derived = Buffer.alloc(l * hLen);
    const key = Buffer.from(secret, 'utf8');

    for (let i = 1; i <= l; i++) {
      const block = this.f(key, salt, iterations, i);
      block.copy(derived, (i - 1) * hLen);
    }

    return derived.subarray(0, dkLen);
  }

  private f(
    key: Buffer,
    salt: Buffer,
    iterations: number,
    blockIndex: number,
  ): Buffer {
    const intBlock = Buffer.alloc(4);
    intBlock.writeUInt32BE(blockIndex, 0);

    let u = this.hmacSha256(key, Buffer.concat([salt, intBlock]));
    const t = Buffer.from(u);

    for (let c = 2; c <= iterations; c++) {
      u = this.hmacSha256(key, u);
      for (let j = 0; j < t.length; j++) {
        t[j] ^= u[j];
      }
    }

    return t;
  }

  private hmacSha256(key: Buffer, data: Buffer): Buffer {
    const blockSize = 64; // SHA-256 block size in bytes
    let workingKey = Buffer.from(key);

    if (workingKey.length > blockSize) {
      workingKey = Buffer.from(sha256(workingKey));
    }

    if (workingKey.length < blockSize) {
      workingKey = Buffer.concat([
        workingKey,
        Buffer.alloc(blockSize - workingKey.length, 0),
      ]);
    }

    const oPad = Buffer.alloc(blockSize);
    const iPad = Buffer.alloc(blockSize);
    for (let i = 0; i < blockSize; i++) {
      oPad[i] = workingKey[i] ^ 0x5c;
      iPad[i] = workingKey[i] ^ 0x36;
    }

    const inner = Buffer.from(sha256(Buffer.concat([iPad, data])));
    return Buffer.from(sha256(Buffer.concat([oPad, inner])));
  }
}
