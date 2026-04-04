import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class SessionRegistryService {
  private readonly activeSessions = new Map<string, string>();

  issueSession(userId: string): string {
    const sessionId = crypto.randomUUID();
    this.activeSessions.set(userId, sessionId);
    return sessionId;
  }

  isSessionActive(userId: string, sessionId?: string): boolean {
    if (!sessionId) return false;
    const active = this.activeSessions.get(userId);
    return !!active && active === sessionId;
  }

  invalidateSession(userId: string): void {
    this.activeSessions.delete(userId);
  }
}
