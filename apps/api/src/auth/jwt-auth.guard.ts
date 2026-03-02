import { ForbiddenException, Injectable, ExecutionContext, Optional, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { setTenantId } from '../common/tenant-context';
import { ImpersonationService } from '../impersonation/impersonation.service';
import { SAFE_HTTP_METHODS } from '../impersonation/impersonation.constants';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private static sharedImpersonationService?: ImpersonationService;

  constructor(@Optional() private readonly impersonation?: ImpersonationService) {
    super();
    if (impersonation) {
      JwtAuthGuard.sharedImpersonationService = impersonation;
    }
  }

  private getImpersonationService() {
    return this.impersonation ?? JwtAuthGuard.sharedImpersonationService;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // @ts-ignore
  async handleRequest<TUser = any>(err: any, user: any, _info: any, context: ExecutionContext, status?: any): Promise<TUser> {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const headerTenantId = req?.headers?.['x-tenant-id'];
    const requestedTenantId = Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId;

    // Dev tenant override headers must never allow an authenticated user to escape JWT tenant scope.
    if (requestedTenantId && requestedTenantId !== user.tenantId) {
      throw new ForbiddenException('Cross-tenant header override is not allowed for authenticated requests');
    }

    // Force downstream services to use the authenticated tenant even if a dev header was accepted earlier.
    if (user.tenantId) {
      setTenantId(req, user.tenantId);
    }

    const impersonationService = this.getImpersonationService();
    const path = String(req.path ?? '');
    const isImpersonationControlPath = path.includes('/admin/impersonation/');
    let impersonation: any = null;
    if (!isImpersonationControlPath && impersonationService) {
      impersonation = await impersonationService.applyToRequest(user, req);
      if (!impersonation && (req as any).cookies?.[impersonationService.getCookieName()]) {
        impersonationService.clearCookie(res);
      }
    }

    const effectiveTenantId = (req as any).user?.tenantId ?? user.tenantId;
    if (effectiveTenantId) {
      setTenantId(req, effectiveTenantId);
    }

    if (impersonation && !SAFE_HTTP_METHODS.has(String(req.method).toUpperCase())) {
      if (!isImpersonationControlPath) {
        const correlationHeader = req?.headers?.[CORRELATION_ID_HEADER];
        const correlationId = Array.isArray(correlationHeader) ? correlationHeader[0] : correlationHeader;

        if (!impersonationService) {
          throw new ForbiddenException('Impersonation is read-only. Stop impersonation to perform this action.');
        }
        await impersonationService.logBlockedWrite({
          req,
          actor: (req as any).realUser ?? user,
          tenantId: effectiveTenantId,
          correlationId,
        });
        throw new ForbiddenException('Impersonation is read-only. Stop impersonation to perform this action.');
      }
    }

    return (req as any).user ?? user;
  }
}
