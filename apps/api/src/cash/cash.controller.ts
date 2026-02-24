import { Controller, Get, Post, Param, Body, Req, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CashService } from './cash.service';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../audit/audit.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class CashController {
  constructor(
    private readonly cashService: CashService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** GET /encounters/:encounterId/financials */
  @Get('encounters/:encounterId/financials')
  async getFinancials(@Req() req: Request, @Param('encounterId') encounterId: string) {
    const tenantId = req['tenantId'];
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, mobile: true } },
        labOrders: {
          select: {
            id: true, status: true, testNameSnapshot: true,
            totalAmount: true, discountAmount: true, discountPct: true,
            payableAmount: true, amountPaid: true, dueAmount: true,
            cancelledAt: true, cancelReason: true,
          },
        },
      },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
    const transactions = await this.cashService.getTransactionsForEncounter(tenantId, encounterId);
    return { encounter, transactions };
  }

  /** POST /encounters/:encounterId:collect-due — receive a due payment */
  @Post('encounters/:encounterId\\:collect-due')
  async collectDue(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Body() body: { amount: number; labOrderId?: string },
  ) {
    const tenantId = req['tenantId'];
    const actorUserId = req['userId'];
    if (!body.amount || body.amount <= 0) throw new BadRequestException('amount must be positive');

    const order = await this.prisma.labOrder.findFirst({
      where: { tenantId, encounterId, ...(body.labOrderId ? { id: body.labOrderId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) throw new NotFoundException('Lab order not found');

    const newDue = Math.max(0, Number(order.dueAmount ?? 0) - body.amount);
    const newPaid = Number(order.amountPaid ?? 0) + body.amount;

    await this.prisma.labOrder.update({
      where: { id: order.id },
      data: { amountPaid: new Decimal(String(newPaid)), dueAmount: new Decimal(String(newDue)) },
    });

    const tx = await this.cashService.logTransaction({
      tenantId, encounterId, labOrderId: order.id,
      type: 'DUE_RECEIVED', amount: body.amount, actorUserId,
      correlationId: req['correlationId'],
    });
    await this.audit.log({
      tenantId, actorUserId, action: 'cash.due_received',
      entityType: 'LabOrder', entityId: order.id,
      after: { amount: body.amount, newDue },
      correlationId: req['correlationId'],
    });
    return { success: true, transaction: tx, dueAmount: newDue };
  }

  /** POST /encounters/:encounterId:apply-discount */
  @Post('encounters/:encounterId\\:apply-discount')
  async applyDiscount(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Body() body: { discountAmount: number; reason: string; labOrderId?: string },
  ) {
    const tenantId = req['tenantId'];
    const actorUserId = req['userId'];
    if (!body.discountAmount || body.discountAmount <= 0) throw new BadRequestException('discountAmount must be positive');
    if (!body.reason?.trim()) throw new BadRequestException('reason is required for discount');

    const order = await this.prisma.labOrder.findFirst({
      where: { tenantId, encounterId, ...(body.labOrderId ? { id: body.labOrderId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) throw new NotFoundException('Lab order not found');

    // Validate against actor max discount
    const payable = Number(order.payableAmount ?? order.totalAmount ?? 0);
    if (payable > 0) {
      const discPct = (body.discountAmount / payable) * 100;
      const maxPct = await this.cashService.resolveMaxDiscountPct(tenantId, actorUserId);
      if (maxPct > 0 && discPct > maxPct) {
        throw new BadRequestException(`Discount ${discPct.toFixed(1)}% exceeds your allowed limit of ${maxPct}%`);
      }
    }

    const newDiscount = Number(order.discountAmount ?? 0) + body.discountAmount;
    const newPayable = Math.max(0, Number(order.payableAmount ?? 0) - body.discountAmount);
    const newDue = Math.max(0, Number(order.dueAmount ?? 0) - body.discountAmount);

    await this.prisma.labOrder.update({
      where: { id: order.id },
      data: {
        discountAmount: new Decimal(String(newDiscount)),
        payableAmount: new Decimal(String(newPayable)),
        dueAmount: new Decimal(String(newDue)),
      },
    });

    const tx = await this.cashService.logTransaction({
      tenantId, encounterId, labOrderId: order.id,
      type: 'DISCOUNT', amount: body.discountAmount, actorUserId,
      reason: body.reason, correlationId: req['correlationId'],
    });
    // Log refund transaction (the actual cash returned)
    await this.cashService.logTransaction({
      tenantId, encounterId, labOrderId: order.id,
      type: 'REFUND', amount: body.discountAmount, actorUserId,
      reason: `Refund for discount: ${body.reason}`,
      correlationId: req['correlationId'],
    });
    await this.audit.log({
      tenantId, actorUserId, action: 'cash.discount_applied',
      entityType: 'LabOrder', entityId: order.id,
      after: { discountAmount: body.discountAmount, reason: body.reason },
      correlationId: req['correlationId'],
    });
    return { success: true, transaction: tx, newPayable, newDue };
  }

  /** POST /encounters/:encounterId:cancel — cancel entire encounter */
  @Post('encounters/:encounterId\\:cancel')
  async cancelEncounter(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Body() body: { reason: string },
  ) {
    const tenantId = req['tenantId'];
    const actorUserId = req['userId'];
    if (!body.reason?.trim()) throw new BadRequestException('reason is required to cancel');

    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      include: { labOrders: true },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
    if (encounter.status === 'cancelled') throw new BadRequestException('Encounter already cancelled');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: 'cancelled', updatedAt: now },
      }),
      ...encounter.labOrders.map(order =>
        this.prisma.labOrder.update({
          where: { id: order.id },
          data: { status: 'cancelled', cancelledAt: now, cancelReason: body.reason, updatedAt: now },
        }),
      ),
    ]);

    // Log refund for each order that had payment
    for (const order of encounter.labOrders) {
      const paid = Number(order.amountPaid ?? 0);
      if (paid > 0) {
        await this.cashService.logTransaction({
          tenantId, encounterId, labOrderId: order.id,
          type: 'CANCELLATION_REFUND', amount: paid, actorUserId,
          reason: body.reason, correlationId: req['correlationId'],
        });
      }
    }
    await this.audit.log({
      tenantId, actorUserId, action: 'encounter.cancelled',
      entityType: 'Encounter', entityId: encounterId,
      after: { reason: body.reason },
      correlationId: req['correlationId'],
    });
    return { success: true, encounterId, status: 'cancelled' };
  }
}
