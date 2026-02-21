import { Module } from '@nestjs/common';
import { TenantResolverMiddleware } from './tenant-resolver.middleware';
import { TenantService } from './tenant.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TenantResolverMiddleware, TenantService],
  exports: [TenantResolverMiddleware, TenantService],
})
export class TenantModule {}
