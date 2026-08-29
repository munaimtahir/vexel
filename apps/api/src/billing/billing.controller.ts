import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { getTenantId } from '../common/tenant-context';
import { Permission } from '../rbac/permissions';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { OpdService } from '../opd/opd.service';

@ApiTags('OPD Billing')
@Controller('opd/billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly svc: OpdService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  @Get('invoices')
  @RequirePermissions(Permission.OPD_BILLING_READ)
  listInvoices(@Req() req: Request, @Query() q: any) {
    return this.svc.listInvoices(this.resolveTenantId(req), q);
  }

  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.OPD_BILLING_MANAGE)
  createInvoice(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createInvoice(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Get('invoices/:invoiceId')
  @RequirePermissions(Permission.OPD_BILLING_READ)
  getInvoice(@Req() req: Request, @Param('invoiceId') invoiceId: string) {
    return this.svc.getInvoice(this.resolveTenantId(req), invoiceId);
  }

  @Get('invoices/:invoiceId/payments')
  @RequirePermissions(Permission.OPD_BILLING_READ)
  listInvoicePayments(@Req() req: Request, @Param('invoiceId') invoiceId: string) {
    return this.svc.listInvoicePayments(this.resolveTenantId(req), invoiceId);
  }

  @Post('invoices/:invoiceId\\:issue')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_BILLING_MANAGE)
  issueInvoice(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.issueInvoice(this.resolveTenantId(req), invoiceId, user.userId, correlationId);
  }

  @Post('invoices/:invoiceId\\:void')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_BILLING_MANAGE)
  voidInvoice(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.voidInvoice(this.resolveTenantId(req), invoiceId, body, user.userId, correlationId);
  }

  @Post('invoices/:invoiceId\\:record-payment')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_BILLING_MANAGE)
  recordInvoicePayment(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.recordPayment(this.resolveTenantId(req), invoiceId, body, user.userId, correlationId);
  }

  @Post('invoices/:invoiceId\\:generate-receipt')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_DOCUMENT_GENERATE)
  generateInvoiceReceipt(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.generateReceipt(
      this.resolveTenantId(req),
      invoiceId,
      user.userId,
      correlationId,
    );
  }
}
