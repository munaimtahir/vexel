import { Module } from '@nestjs/common';
import { TenantResolverMiddleware } from './tenant-resolver.middleware';

@Module({
  providers: [TenantResolverMiddleware],
  exports: [TenantResolverMiddleware],
})
export class TenantModule {}
