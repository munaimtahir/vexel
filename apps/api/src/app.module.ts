import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { TenantResolverMiddleware } from './tenant/tenant-resolver.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { RolesModule } from './roles/roles.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { CatalogModule } from './catalog/catalog.module';
import { AuditModule } from './audit/audit.module';
import { JobsModule } from './jobs/jobs.module';
import { RbacModule } from './rbac/rbac.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    TenantModule,
    UsersModule,
    TenantsModule,
    RolesModule,
    FeatureFlagsModule,
    CatalogModule,
    AuditModule,
    JobsModule,
    RbacModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        { path: 'api/health', method: RequestMethod.GET },
        { path: 'api/health/(.*)', method: RequestMethod.GET },
        { path: 'api/auth/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
