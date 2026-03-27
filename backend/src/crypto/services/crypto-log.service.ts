import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface CryptoStepEntry {
  id: string;
  timestamp: Date;
  actionId: string;
  userId?: string; // User ID from JWT token
  actionName: string;
  operation: 'encrypt' | 'decrypt';

  // NEW: Detailed layer & step info
  layer: string; // HMAC, AES-256, DB, ECB, etc.
  step?: string; // SubBytes, ShiftRows, MixColumns, AddRoundKey
  round?: number; // AES round number

  // CHANGED: plaintext/ciphertext → input/output
  input: string; // plaintext (encrypt start) or encrypted (decrypt start)
  output: string; // encrypted (encrypt) or plaintext (decrypt end)

  iv?: string;
  tag?: string; // GCM auth tag
  authTag?: string; // NEW: Auth verification result (true/false as string)
  hmac?: string;
  keySnippet?: string;
  status: 'success' | 'failure';
}

export interface CryptoActionGroup {
  id: string;
  actionName: string;
  operation: 'encrypt' | 'decrypt' | 'mixed';
  status: 'success' | 'failure';
  startedAt: Date;
  updatedAt: Date;
  steps: CryptoStepEntry[];
}

@Injectable()
export class CryptoLogService {
  private readonly groups = new Map<string, CryptoActionGroup>();
  private readonly groupSubject = new Subject<CryptoActionGroup>();
  private readonly maxGroups = 120;

  addLog(entry: Omit<CryptoStepEntry, 'id' | 'timestamp'>) {
    const fullEntry: CryptoStepEntry = {
      ...entry,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
    };

    const existing = this.groups.get(fullEntry.actionId);
    if (!existing) {
      this.groups.set(fullEntry.actionId, {
        id: fullEntry.actionId,
        actionName: fullEntry.actionName,
        operation: fullEntry.operation,
        status: fullEntry.status,
        startedAt: fullEntry.timestamp,
        updatedAt: fullEntry.timestamp,
        steps: [fullEntry],
      });
    } else {
      existing.steps.push(fullEntry);
      existing.updatedAt = fullEntry.timestamp;
      if (existing.operation !== fullEntry.operation) {
        existing.operation = 'mixed';
      }
      if (fullEntry.status === 'failure') {
        existing.status = 'failure';
      }
      this.groups.set(fullEntry.actionId, existing);
    }

    this.trimOverflow();
    this.groupSubject.next(this.groups.get(fullEntry.actionId)!);
  }

  getGroups(params?: {
    page?: number;
    limit?: number;
    operation?: 'encrypt' | 'decrypt' | 'mixed';
    keyword?: string;
  }) {
    const page = Math.max(1, Number(params?.page ?? 1));
    const limit = Math.max(1, Math.min(50, Number(params?.limit ?? 10)));
    const keyword = (params?.keyword ?? '').trim().toLowerCase();

    let items = Array.from(this.groups.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    if (params?.operation) {
      items = items.filter((g) => g.operation === params.operation);
    }

    if (keyword) {
      items = items.filter((g) => {
        if (g.actionName.toLowerCase().includes(keyword)) return true;
        return g.steps.some(
          (s) =>
            (s.input ?? '').toLowerCase().includes(keyword) ||
            (s.output ?? '').toLowerCase().includes(keyword) ||
            (s.layer ?? '').toLowerCase().includes(keyword),
        );
      });
    }

    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;

    return {
      items: items.slice(start, start + limit),
      page,
      limit,
      total,
      pages,
    };
  }

  getLogObservable() {
    return this.groupSubject.asObservable();
  }

  private trimOverflow() {
    if (this.groups.size <= this.maxGroups) return;

    const ordered = Array.from(this.groups.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    const keepIds = new Set(ordered.slice(0, this.maxGroups).map((g) => g.id));
    for (const id of this.groups.keys()) {
      if (!keepIds.has(id)) {
        this.groups.delete(id);
      }
    }
  }
}
