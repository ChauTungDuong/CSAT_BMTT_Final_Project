import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

type CryptoTraceStore = {
  actionId: string;
  actionName: string;
  userId?: string; // Track user performing crypto operation
};

@Injectable()
export class CryptoTraceContextService {
  private readonly storage = new AsyncLocalStorage<CryptoTraceStore>();

  runWithContext<T>(
    actionId: string,
    actionName: string,
    callback: () => T,
  ): T {
    return this.storage.run({ actionId, actionName }, callback);
  }

  getActionId(): string | undefined {
    return this.storage.getStore()?.actionId;
  }

  getActionName(): string | undefined {
    return this.storage.getStore()?.actionName;
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
