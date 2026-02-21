import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditEventsController } from './audit-events.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditEventsController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
