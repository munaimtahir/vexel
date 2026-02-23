import { Module } from '@nestjs/common';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [PrismaModule, AuditModule, RbacModule, DocumentsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
