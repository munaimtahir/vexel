import { Module } from '@nestjs/common';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';
import { DocumentsModule } from '../documents/documents.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LimsFeatureGuard } from '../common/lims-feature.guard';

@Module({
  imports: [PrismaModule, AuditModule, RbacModule, DocumentsModule, FeatureFlagsModule],
  controllers: [ResultsController],
  providers: [ResultsService, LimsFeatureGuard],
})
export class ResultsModule {}
