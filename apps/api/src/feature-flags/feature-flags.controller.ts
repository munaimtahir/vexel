import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeatureFlagsService } from './feature-flags.service';

@ApiTags('FeatureFlags')
@Controller('feature-flags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagsService) {}

  @Get()
  listFlags() { return this.svc.list(); }

  @Put(':key')
  setFlag(@Param('key') key: string, @Body() body: { enabled: boolean }) {
    return this.svc.set(key, body.enabled);
  }
}
