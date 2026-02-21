import { Controller, Get, Post, Patch, Put, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  listUsers(@Query() q: any) { return this.svc.list(q); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() body: any) { return this.svc.create(body); }

  @Get(':id')
  getUser(@Param('id') id: string) { return this.svc.getById(id); }

  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Get(':id/roles')
  getUserRoles(@Param('id') id: string) { return this.svc.getRoles(id); }

  @Put(':id/roles')
  setUserRoles(@Param('id') id: string, @Body() body: any) { return this.svc.setRoles(id, body); }
}
