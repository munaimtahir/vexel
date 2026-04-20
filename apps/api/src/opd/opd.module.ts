import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { OpdController } from './opd.controller';
import { OpdService } from './opd.service';

@Module({
  imports: [AuditModule, DocumentsModule],
  controllers: [OpdController],
  providers: [OpdService],
  exports: [OpdService],
})
export class OpdModule {}
