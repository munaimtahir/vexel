import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogJobsController } from './catalog-jobs.controller';
import { CatalogJobsService } from './catalog-jobs.service';
import { AuditModule } from '../audit/audit.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [AuditModule, FeatureFlagsModule],
  controllers: [CatalogController, CatalogJobsController],
  providers: [CatalogService, CatalogJobsService],
})
export class CatalogModule {}
