import { Module } from '@nestjs/common';
import { TemplatesController, TemplateBlueprintsController, TestTemplateMapsController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TemplatesController, TemplateBlueprintsController, TestTemplateMapsController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
