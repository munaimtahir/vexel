import { Module } from '@nestjs/common';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LimsFeatureGuard } from '../common/lims-feature.guard';

@Module({ imports: [AuditModule, DocumentsModule, FeatureFlagsModule], controllers: [EncountersController], providers: [EncountersService, LimsFeatureGuard] })
export class EncountersModule {}
