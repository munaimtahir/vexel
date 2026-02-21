import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditEventsController } from './audit-events.controller';

@Global()
@Module({
  controllers: [AuditEventsController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
