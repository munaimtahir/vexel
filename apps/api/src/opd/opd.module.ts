import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OpdController } from './opd.controller';
import { OpdService } from './opd.service';

@Module({
  imports: [AuditModule],
  controllers: [OpdController],
  providers: [OpdService],
  exports: [OpdService],
})
export class OpdModule {}
