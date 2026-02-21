import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';

@ApiTags('Catalog')
@Controller('catalog')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('tests')
  listTests(@Query() q: any) { return this.svc.listTests(q); }

  @Post('tests')
  @HttpCode(HttpStatus.CREATED)
  createTest(@Body() b: any) { return this.svc.createTest(b); }

  @Get('tests/:id')
  getTest(@Param('id') id: string) { return this.svc.getTest(id); }

  @Patch('tests/:id')
  updateTest(@Param('id') id: string, @Body() b: any) { return this.svc.updateTest(id, b); }

  @Delete('tests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTest(@Param('id') id: string) { return this.svc.deleteTest(id); }

  @Get('panels')
  listPanels(@Query() q: any) { return this.svc.listPanels(q); }

  @Post('panels')
  @HttpCode(HttpStatus.CREATED)
  createPanel(@Body() b: any) { return this.svc.createPanel(b); }
}
