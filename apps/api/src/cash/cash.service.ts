import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export type CashTxType = 'PAYMENT' | 'DISCOUNT' | 'REFUND' | 'DUE_RECEIVED' | 'CANCELLATION_REFUND';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  async logTransaction(opts: {
    tenantId: string;
    encounterId: string;
    labOrderId?: string;
    type: CashTxType;
    amount: number | Decimal;
    actorUserId: string;
    reason?: string;
    correlationId?: string;
  }) {
    return this.prisma.cashTransaction.create({
      data: {
        tenantId: opts.tenantId,
        encounterId: opts.encounterId,
        labOrderId: opts.labOrderId ?? null,
        type: opts.type,
        amount: new Decimal(String(opts.amount)),
        actorUserId: opts.actorUserId,
        reason: opts.reason ?? null,
        correlationId: opts.correlationId ?? null,
      },
    });
  }

  async getTransactionsForEncounter(tenantId: string, encounterId: string) {
    return this.prisma.cashTransaction.findMany({
      where: { tenantId, encounterId },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  /** Resolve max discount % for a user: user override wins over role default */
  async resolveMaxDiscountPct(tenantId: string, userId: string): Promise<number> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        userRoles: { include: { role: { select: { maxDiscountPct: true } } } },
      },
    });
    if (!user) return 0;
    if (user.maxDiscountPct != null) return Number(user.maxDiscountPct);
    const roleMax = user.userRoles
      .map(ur => Number(ur.role.maxDiscountPct ?? 0))
      .reduce((a, b) => Math.max(a, b), 0);
    return roleMax;
  }
}
