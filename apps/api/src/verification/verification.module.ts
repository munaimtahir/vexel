import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LimsFeatureGuard } from '../common/lims-feature.guard';

@Module({
  imports: [AuditModule, DocumentsModule, FeatureFlagsModule],
  controllers: [VerificationController],
  providers: [VerificationService, LimsFeatureGuard],
})
export class VerificationModule {}
