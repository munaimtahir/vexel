import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { setTenantId } from '../common/tenant-context';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // DEV: allow x-tenant-id header when explicitly enabled
    if (process.env.TENANCY_DEV_HEADER_ENABLED === 'true') {
      const devTenantId = req.headers['x-tenant-id'] as string | undefined;
      if (devTenantId) {
        setTenantId(req, devTenantId);
        return next();
      }
    }

    // PROD: resolve by Host header
    // TODO: implement host → tenant lookup via DB
    const host = req.hostname;
    // Stub: for now accept any host and set a placeholder
    // Real impl: look up tenant by domain in DB
    if (host) {
      // Placeholder: use 'system' as fallback tenant ID in dev
      const tenantId = process.env.DEFAULT_TENANT_ID ?? 'system';
      setTenantId(req, tenantId);
    }

    next();
  }
}
