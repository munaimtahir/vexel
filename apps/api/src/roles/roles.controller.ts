import { Controller, Get, Post, Patch, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly svc: RolesService) {}

  @Get()
  listRoles() { return this.svc.list(); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createRole(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id')
  updateRole(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }
}
