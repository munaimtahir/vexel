import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantServiceHealthService } from './tenant-service-health.service';
import { TenantModule } from '../tenant/tenant.module';
import { RbacModule } from '../rbac/rbac.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [TenantModule, RbacModule, FeatureFlagsModule, CatalogModule, AuditModule, PrismaModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantServiceHealthService],
  exports: [TenantsService],
})
export class TenantsModule {}
