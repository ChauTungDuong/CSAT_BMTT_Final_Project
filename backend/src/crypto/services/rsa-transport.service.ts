import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  computeKeyId,
  parseRsaPrivateKeyFromPem,
  parseRsaPublicKeyFromPem,
  RsaPrivateKeyMaterial,
  RsaPublicKeyMaterial,
  rsaOaepDecrypt,
} from '../pure/rsa-manual';
import { decryptGCM, encryptGCM } from '../aes-gcm';

export interface EncryptedEnvelope {
  kid?: string;
  encryptedKey?: string;
  iv: string;
  tag: string;
  payload: string;
  aad?: string;
}

@Injectable()
export class RsaTransportService {
  private cachedPublicKey: RsaPublicKeyMaterial | null = null;
  private cachedPrivateKey: RsaPrivateKeyMaterial | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>('APP_LAYER_CRYPTO_ENABLED') === 'true';
  }

  getPublicKeyMeta() {
    const enabled = this.isEnabled();
    if (!enabled) {
      return { enabled: false };
    }

    const publicKey = this.resolvePublicKey();
    if (!publicKey) {
      throw new InternalServerErrorException(
        'APP_LAYER_CRYPTO_ENABLED=true nhưng chưa cấu hình RSA public key',
      );
    }

    return {
      enabled: true,
      alg: 'RSA-OAEP-256(manual)/AES-256-GCM',
      kid: computeKeyId(publicKey),
      n: publicKey.nHex,
      e: publicKey.eHex,
    };
  }

  decryptSessionKey(encryptedSessionKeyBase64: string): Buffer {
    const privateKey = this.resolvePrivateKey();

    let encryptedSessionKeyBytes: Uint8Array;
    try {
      encryptedSessionKeyBytes = new Uint8Array(
        Buffer.from(encryptedSessionKeyBase64, 'base64'),
      );
    } catch {
      throw new BadRequestException('Session key base64 không hợp lệ');
    }

    try {
      const sessionKey = rsaOaepDecrypt(encryptedSessionKeyBytes, privateKey);
      if (sessionKey.length !== 32) {
        throw new BadRequestException('AES session key không hợp lệ');
      }
      return Buffer.from(sessionKey);
    } catch {
      throw new BadRequestException('Không thể giải mã AES session key');
    }
  }

  decryptEnvelope(
    envelope: EncryptedEnvelope,
    sessionKey: Buffer,
    expectedAad?: string,
  ): string {
    if (sessionKey.length !== 32) {
      throw new BadRequestException('AES session key không hợp lệ');
    }

    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.payload, 'base64');

    const aad = expectedAad || envelope.aad;
    if (expectedAad && envelope.aad && expectedAad !== envelope.aad) {
      throw new BadRequestException('AAD không khớp');
    }

    try {
      const decrypted = decryptGCM(
        sessionKey,
        iv,
        ciphertext,
        tag,
        aad ? Buffer.from(aad, 'utf8') : undefined,
      );
      return Buffer.from(decrypted).toString('utf8');
    } catch {
      throw new BadRequestException('Payload mã hóa không hợp lệ');
    }
  }

  encryptWithSessionKey(
    payload: string,
    sessionKey: Buffer,
    aad?: string,
  ): EncryptedEnvelope {
    if (sessionKey.length !== 32) {
      throw new BadRequestException('AES session key không hợp lệ');
    }

    const iv = crypto.randomBytes(12);

    const plainBytes = Buffer.from(payload, 'utf8');
    const { ciphertext, authTag } = encryptGCM(
      sessionKey,
      iv,
      plainBytes,
      aad ? Buffer.from(aad, 'utf8') : undefined,
    );

    return {
      iv: iv.toString('base64'),
      tag: Buffer.from(authTag).toString('base64'),
      payload: Buffer.from(ciphertext).toString('base64'),
      ...(aad ? { aad } : {}),
    };
  }

  private resolvePublicKey(): RsaPublicKeyMaterial | null {
    if (this.cachedPublicKey) {
      return this.cachedPublicKey;
    }

    const nHex = this.config.get<string>('RSA_N_HEX')?.trim();
    const eHex = this.config.get<string>('RSA_E_HEX')?.trim();
    if (nHex && eHex) {
      this.cachedPublicKey = {
        n: BigInt(`0x${nHex}`),
        e: BigInt(`0x${eHex}`),
        nHex,
        eHex,
      };
      return this.cachedPublicKey;
    }

    const publicKeyPem = this.resolveKey('public');
    if (!publicKeyPem) {
      return null;
    }

    this.cachedPublicKey = parseRsaPublicKeyFromPem(publicKeyPem);
    return this.cachedPublicKey;
  }

  private resolvePrivateKey(): RsaPrivateKeyMaterial {
    if (this.cachedPrivateKey) {
      return this.cachedPrivateKey;
    }

    const nHex = this.config.get<string>('RSA_N_HEX')?.trim();
    const eHex = this.config.get<string>('RSA_E_HEX')?.trim();
    const dHex = this.config.get<string>('RSA_D_HEX')?.trim();
    if (nHex && eHex && dHex) {
      this.cachedPrivateKey = {
        n: BigInt(`0x${nHex}`),
        e: BigInt(`0x${eHex}`),
        d: BigInt(`0x${dHex}`),
        nHex,
        eHex,
        dHex,
      };
      return this.cachedPrivateKey;
    }

    const privateKeyPem = this.resolveKey('private');
    if (!privateKeyPem) {
      throw new InternalServerErrorException('Thiếu RSA private key');
    }

    this.cachedPrivateKey = parseRsaPrivateKeyFromPem(privateKeyPem);
    return this.cachedPrivateKey;
  }

  private resolveKey(kind: 'public' | 'private'): string | null {
    const pemEnv =
      kind === 'public'
        ? this.config.get<string>('RSA_PUBLIC_KEY_PEM')
        : this.config.get<string>('RSA_PRIVATE_KEY_PEM');

    if (pemEnv?.trim()) {
      return pemEnv.replace(/\\n/g, '\n');
    }

    const configuredPath =
      kind === 'public'
        ? this.config.get<string>('RSA_PUBLIC_KEY_PATH')
        : this.config.get<string>('RSA_PRIVATE_KEY_PATH');

    if (!configuredPath?.trim()) return null;

    const absPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
    if (!fs.existsSync(absPath)) return null;

    return fs.readFileSync(absPath, 'utf8');
  }
}
