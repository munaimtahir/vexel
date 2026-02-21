import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('audit-events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditEventsController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  list(@Query() q: any) {
    return this.svc.list(q);
  }
}
