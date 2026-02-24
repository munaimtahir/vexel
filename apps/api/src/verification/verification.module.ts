import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [AuditModule, DocumentsModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
