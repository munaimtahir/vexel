import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/**
 * Backend-authoritative kill switch for every LIMS workflow endpoint.
 *
 * It deliberately resolves the flag from the authenticated tenant, never from
 * a request parameter or header. Individual services may retain their own
 * checks as defence in depth, but controllers must use this guard so disabled
 * modules cannot expose read-only or command routes accidentally.
 */
@Injectable()
export class LimsFeatureGuard implements CanActivate {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request?.user?.tenantId as string | undefined;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required for LIMS access');
    }

    if (!(await this.featureFlags.isEnabled(tenantId, 'module.lims'))) {
      throw new ForbiddenException('The LIMS module is disabled for this tenant');
    }

    return true;
  }
}
