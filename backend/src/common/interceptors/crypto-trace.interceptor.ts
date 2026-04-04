import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CryptoTraceContextService } from '../../crypto/services/crypto-trace-context.service';

@Injectable()
export class CryptoTraceInterceptor implements NestInterceptor {
  constructor(private readonly traceContext: CryptoTraceContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userId = user?.sub || 'anonymous';

    const result = this.traceContext.runWithContext(() => {
      this.traceContext.setUserId(userId);
      return next.handle();
    });

    return result as Observable<any>;
  }
}
