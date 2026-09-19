import { Module } from '@nestjs/common';
import { SampleCollectionController } from './sample-collection.controller';
import { SampleCollectionService } from './sample-collection.service';
import { AuditModule } from '../audit/audit.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LimsFeatureGuard } from '../common/lims-feature.guard';

@Module({
  imports: [AuditModule, FeatureFlagsModule],
  controllers: [SampleCollectionController],
  providers: [SampleCollectionService, LimsFeatureGuard],
  exports: [SampleCollectionService],
})
export class SampleCollectionModule {}
