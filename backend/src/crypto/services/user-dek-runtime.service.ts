import { Injectable } from '@nestjs/common';

type RuntimeDekEntry = {
  dek: Buffer;
  expiresAt: number;
};

@Injectable()
export class UserDekRuntimeService {
  private readonly cache = new Map<string, RuntimeDekEntry>();
  private readonly defaultTtlMs = 8 * 60 * 60 * 1000;

  setUserDek(userId: string, dek: Buffer, ttlMs = this.defaultTtlMs): void {
    this.cleanupExpired();
    this.cache.set(userId, {
      dek: Buffer.from(dek),
      expiresAt: Date.now() + Math.max(60_000, ttlMs),
    });
  }

  getUserDek(userId: string): Buffer | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(userId);
      return null;
    }
    return Buffer.from(entry.dek);
  }

  clearUserDek(userId: string): void {
    this.cache.delete(userId);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [userId, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(userId);
      }
    }
  }
}
