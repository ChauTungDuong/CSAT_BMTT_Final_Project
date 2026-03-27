import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CryptoTraceContextService } from '../../crypto/services/crypto-trace-context.service';
import * as crypto from 'crypto';

@Injectable()
export class CryptoTraceInterceptor implements NestInterceptor {
  constructor(private readonly traceContext: CryptoTraceContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Generate actionId and prepare context
    const actionId = crypto.randomUUID();
    const actionName = `${request.method} ${request.path}`;
    const userId = user?.sub || 'anonymous';

    // Use runWithContext to establish the async local storage context
    // The context will persist through all async operations within the callback
    const result = this.traceContext.runWithContext(
      actionId,
      actionName,
      () => {
        // Set userId in the context
        this.traceContext.setUserId(userId);

        // Return the observable from next.handle()
        // This observable will execute within the established context
        return next.handle();
      },
    );

    return result as Observable<any>;
  }
}
