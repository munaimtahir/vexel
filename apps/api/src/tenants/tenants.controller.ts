import { Controller, Get, Post, Patch, Put, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly svc: TenantsService) {}

  @Get()
  listTenants(@Query() q: any) { return this.svc.list(q); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTenant(@Body() body: any) { return this.svc.create(body); }

  @Get(':id')
  getTenant(@Param('id') id: string) { return this.svc.getById(id); }

  @Patch(':id')
  updateTenant(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Get(':id/config')
  getConfig(@Param('id') id: string) { return this.svc.getConfig(id); }

  @Patch(':id/config')
  updateConfig(@Param('id') id: string, @Body() body: any) { return this.svc.updateConfig(id, body); }

  @Get(':id/feature-flags')
  getFlags(@Param('id') id: string) { return this.svc.getFeatureFlags(id); }

  @Put(':id/feature-flags')
  setFlags(@Param('id') id: string, @Body() body: any) { return this.svc.setFeatureFlags(id, body); }
}
