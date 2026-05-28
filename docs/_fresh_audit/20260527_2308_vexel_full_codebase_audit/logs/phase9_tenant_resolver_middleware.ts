import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { setTenantId } from '../common/tenant-context';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (process.env.TENANCY_DEV_HEADER_ENABLED === 'true') {
      const devTenantId = req.headers['x-tenant-id'] as string | undefined;
      if (devTenantId) {
        setTenantId(req, devTenantId);
        return next();
      }
    }

    const host = req.hostname ?? '';
    const tenant = await this.tenantService.findByDomain(host);

    if (tenant) {
      setTenantId(req, tenant.id);
    }

    next();
  }
}
