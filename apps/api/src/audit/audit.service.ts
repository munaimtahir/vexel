import { Injectable } from '@nestjs/common';

export interface AuditEventInput {
  tenantId: string;
  actorUserId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  before?: any;
  after?: any;
}

@Injectable()
export class AuditService {
  // TODO: persist to DB via Prisma
  async log(event: AuditEventInput): Promise<void> {
    console.log('[AUDIT]', JSON.stringify(event));
  }

  async list(filters: any) {
    return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
}
