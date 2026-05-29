import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemLogsService, LogCategory } from '../common/system-logs.service';

@ApiTags('SystemLogs')
@Controller('system-logs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SystemLogsController {
  constructor(private readonly systemLogsService: SystemLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Query structured category-wise system logs' })
  async getLogs(
    @Query('category') category?: LogCategory,
    @Query('level') level?: 'info' | 'warn' | 'error',
    @Query('correlationId') correlationId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.systemLogsService.query({
      category,
      level,
      correlationId,
      tenantId,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
