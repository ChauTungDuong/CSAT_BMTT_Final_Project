import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, ip, method, url } = request;

    return next.handle().pipe(
      tap(() => {
        if (user) {
          this.auditService
            .log('API_ACCESS', user.sub, null, ip, `${method} ${url}`)
            .catch(() => undefined);
        }
      }),
    );
  }
}
