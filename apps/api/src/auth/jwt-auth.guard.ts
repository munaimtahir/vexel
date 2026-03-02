import { ForbiddenException, Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { setTenantId } from '../common/tenant-context';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }

    const req = context.switchToHttp().getRequest();
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

    return user;
  }
}
