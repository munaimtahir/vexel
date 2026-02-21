import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { TenantResolverMiddleware } from './tenant/tenant-resolver.middleware';
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

@Module({
  imports: [
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
        { path: 'api/tenants', method: RequestMethod.ALL },
        { path: 'api/tenants/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
