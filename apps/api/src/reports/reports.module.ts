import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LimsFeatureGuard } from '../common/lims-feature.guard';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [ReportsController],
  providers: [ReportsService, LimsFeatureGuard],
})
export class ReportsModule {}
