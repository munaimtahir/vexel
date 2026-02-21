import { Request } from 'express';

export const TENANT_ID_KEY = '__tenantId__';

export function getTenantId(req: Request): string | undefined {
  return (req as any)[TENANT_ID_KEY];
}

export function setTenantId(req: Request, tenantId: string): void {
  (req as any)[TENANT_ID_KEY] = tenantId;
}
