import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogImportExportService } from './catalog-import-export.service';
import { CatalogJobsController } from './catalog-jobs.controller';
import { CatalogJobsService } from './catalog-jobs.service';
import { AuditModule } from '../audit/audit.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [AuditModule, FeatureFlagsModule],
  controllers: [CatalogController, CatalogJobsController],
  providers: [CatalogService, CatalogImportExportService, CatalogJobsService],
})
export class CatalogModule {}
