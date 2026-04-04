import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  EncryptedEnvelope,
  RsaTransportService,
} from '../services/rsa-transport.service';

@Injectable()
export class TransportEnvelopeInterceptor implements NestInterceptor {
  private readonly replayCache = new Map<string, number>();

  constructor(
    private readonly rsaTransport: RsaTransportService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<any>();
    const res = context.switchToHttp().getResponse<Response>();

    const path = this.normalizePath(req.originalUrl || req.url || '');
    const strictEnabled = this.isStrictTransportMode();
    const sensitivePath = this.isSensitivePath(path);

    if (path === '/api/transport/public-key') {
      return next.handle();
    }

    if (!this.rsaTransport.isEnabled()) {
      return next.handle();
    }

    if (!this.isEnvelopeMode(req)) {
      if (strictEnabled) {
        throw new BadRequestException(
          'Yêu cầu bắt buộc dùng envelope mã hóa ở chế độ strict transport',
        );
      }
      return next.handle();
    }

    const method = String(req.method || 'GET').toUpperCase();
    const timestamp = this.readHeader(req, 'x-app-timestamp');
    const nonce = this.readHeader(req, 'x-app-nonce');
    const encryptedSessionKey = this.readHeader(req, 'x-app-session-key');

    if (!timestamp || !nonce || !encryptedSessionKey) {
      throw new BadRequestException('Thiếu metadata của envelope transport');
    }

    const timestampMs = Number(timestamp);
    if (!Number.isFinite(timestampMs)) {
      throw new BadRequestException('Timestamp không hợp lệ');
    }

    const skewMs = this.getAllowedSkewMs();
    if (Math.abs(Date.now() - timestampMs) > skewMs) {
      throw new BadRequestException('Timestamp đã hết hạn hoặc sai lệch lớn');
    }

    this.assertNonceFresh(nonce, timestampMs, skewMs);
    const aad = this.buildAad(method, path, timestamp, nonce);
    const sessionKey = this.rsaTransport.decryptSessionKey(encryptedSessionKey);

    if (this.shouldDecryptBody(method, req.body)) {
      const envelope = this.parseEnvelope(req.body);
      const decrypted = this.rsaTransport.decryptEnvelope(
        envelope,
        sessionKey,
        aad,
      );
      req.body = this.parseJson(decrypted);
    }

    res.setHeader('x-app-envelope', '1');
    if (sensitivePath) {
      res.setHeader('x-app-sensitive', '1');
    }

    return next.handle().pipe(
      map((data) => {
        const payload = JSON.stringify(data ?? null);
        return this.rsaTransport.encryptWithSessionKey(
          payload,
          sessionKey,
          aad,
        );
      }),
    );
  }

  private readHeader(req: any, key: string): string | null {
    const value = req.headers?.[key];
    if (Array.isArray(value)) {
      return value.length > 0 ? String(value[0]) : null;
    }
    return value !== undefined ? String(value) : null;
  }

  private isEnvelopeMode(req: any): boolean {
    return this.readHeader(req, 'x-app-envelope') === '1';
  }

  private normalizePath(url: string): string {
    const withoutQuery = url.split('?')[0] || '/';
    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  }

  private shouldDecryptBody(method: string, body: unknown): boolean {
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return false;
    }
    if (body === undefined || body === null) {
      return false;
    }
    if (typeof body === 'object') {
      return Object.keys(body as Record<string, unknown>).length > 0;
    }
    return true;
  }

  private parseEnvelope(body: unknown): EncryptedEnvelope {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Body envelope không hợp lệ');
    }

    const raw = body as Record<string, unknown>;
    const required = ['iv', 'tag', 'payload'] as const;
    for (const field of required) {
      if (typeof raw[field] !== 'string' || !(raw[field] as string).trim()) {
        throw new BadRequestException(`Thiếu trường envelope: ${field}`);
      }
    }

    return {
      kid: typeof raw.kid === 'string' ? raw.kid : undefined,
      encryptedKey:
        typeof raw.encryptedKey === 'string' ? raw.encryptedKey : undefined,
      iv: String(raw.iv),
      tag: String(raw.tag),
      payload: String(raw.payload),
      aad: typeof raw.aad === 'string' ? raw.aad : undefined,
    };
  }

  private parseJson(input: string): unknown {
    try {
      return JSON.parse(input);
    } catch {
      throw new BadRequestException('Payload giải mã không phải JSON hợp lệ');
    }
  }

  private getAllowedSkewMs(): number {
    const raw = Number(this.config.get<string>('APP_LAYER_CRYPTO_MAX_SKEW_MS'));
    if (Number.isFinite(raw) && raw > 0) {
      return raw;
    }
    return 120_000;
  }

  private assertNonceFresh(
    nonce: string,
    timestampMs: number,
    skewMs: number,
  ): void {
    const now = Date.now();

    // Keep an in-memory replay window bounded by timestamp skew.
    for (const [cacheKey, expiresAt] of this.replayCache.entries()) {
      if (expiresAt <= now) {
        this.replayCache.delete(cacheKey);
      }
    }

    const cacheKey = `${nonce}:${timestampMs}`;
    if (this.replayCache.has(cacheKey)) {
      throw new BadRequestException('Replay request bị từ chối');
    }

    this.replayCache.set(cacheKey, now + skewMs * 2);
    if (this.replayCache.size > 5000) {
      const oldest = this.replayCache.keys().next().value;
      if (oldest) {
        this.replayCache.delete(oldest);
      }
    }
  }

  private buildAad(
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
  ): string {
    return `${method}|${path}|${timestamp}|${nonce}`;
  }

  private isStrictTransportMode(): boolean {
    const strict = this.config.get<string>('APP_LAYER_CRYPTO_STRICT');
    if (strict === 'false') {
      return false;
    }
    return this.rsaTransport.isEnabled();
  }

  private isSensitivePath(path: string): boolean {
    return (
      path === '/api/auth/me' ||
      path === '/api/customers/me' ||
      path === '/api/customers/me/verify-pin' ||
      path === '/api/customers/me/pin/change/request-otp' ||
      path === '/api/customers/me/pin/change/confirm' ||
      path === '/api/customers/me/setup-pin'
    );
  }
}
