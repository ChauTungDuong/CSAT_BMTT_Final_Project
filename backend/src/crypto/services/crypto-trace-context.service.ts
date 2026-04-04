import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

type CryptoTraceStore = {
  userId?: string; // Track user performing crypto operation
};

@Injectable()
export class CryptoTraceContextService {
  private readonly storage = new AsyncLocalStorage<CryptoTraceStore>();

  runWithContext<T>(callback: () => T): T {
    return this.storage.run({}, callback);
  }

  setUserId(userId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.userId = userId;
    }
  }

  getUserId(): string | undefined {
    return this.storage.getStore()?.userId;
  }
}
