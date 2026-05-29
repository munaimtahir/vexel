import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SystemLogsService, LogCategory } from './system-logs.service';
import { Request } from 'express';

@Injectable()
export class SystemLogsInterceptor implements NestInterceptor {
  constructor(private readonly systemLogsService: SystemLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    if (!request) return next.handle();

    const { method, url, headers } = request;
    const correlationId = headers['x-correlation-id'] as string;
    const user = (request as any).user;
    const tenantId = user?.tenantId;

    // Determine category based on URL
    let category: LogCategory = 'system';
    if (url.includes('/api/auth')) category = 'auth';
    else if (url.includes('/api/tenants') || url.includes('/api/tenant')) category = 'tenancy';
    else if (url.includes('/api/encounters') || url.includes('/api/patients') || url.includes('/api/sample-collection') || url.includes('/api/results') || url.includes('/api/verification')) category = 'workflow';
    else if (url.includes('/api/documents')) category = 'documents';
    else if (url.includes('/api/pdf')) category = 'pdf';
    else if (url.includes('/api/catalog')) category = 'catalog';
    else if (url.includes('/api/feature-flags')) category = 'feature_flags';
    else if (url.includes('/api/health')) category = 'health';
    else if (url.includes('/api/system-logs')) category = 'system';

    return next.handle().pipe(
      tap({
        next: () => {
          // Exclude system logs queries themselves to avoid infinite log loops
          if (url.includes('/api/system-logs') && method === 'GET') {
            return;
          }
          this.systemLogsService.log({
            category,
            level: 'info',
            message: `HTTP ${method} ${url} successful`,
            correlationId,
            tenantId,
            metadata: { method, url },
          });
        },
        error: (err) => {
          this.systemLogsService.log({
            category,
            level: 'error',
            message: `HTTP ${method} ${url} failed: ${err.message || err}`,
            correlationId,
            tenantId,
            metadata: { method, url, error: err.message },
          });
        }
      })
    );
  }
}
