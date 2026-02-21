import * as crypto from 'crypto';

// Canonical serialiser: stable key sort + ISO dates + 4dp numbers
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

export function payloadHash(obj: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(obj)).digest('hex');
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as object)
      .sort()
      .reduce((acc, k) => ({ ...acc, [k]: sortKeys((value as Record<string, unknown>)[k]) }), {});
  }
  return value;
}

// ─── Receipt Payload ──────────────────────────────────────────────────────

export interface ReceiptPayload {
  receiptNumber: string;
  issuedAt: string;        // ISO 8601
  patientName: string;
  patientMrn: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;     // 4dp rounded
    total: number;         // 4dp rounded
  }[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  tenantName: string;
  tenantLogoUrl?: string;
  reportHeader?: string;
  reportFooter?: string;
}

// ─── Lab Report Payload ───────────────────────────────────────────────────

export interface LabReportPayload {
  reportNumber: string;
  issuedAt: string;        // ISO 8601
  patientName: string;
  patientMrn: string;
  patientDob?: string;     // ISO 8601 date only
  patientGender?: string;
  encounterId: string;
  orderedBy?: string;
  tests: {
    testCode: string;
    testName: string;
    parameters: {
      parameterCode: string;
      parameterName: string;
      value: string;
      unit?: string;
      referenceRange?: string;
      flag?: string;       // normal | high | low | critical
    }[];
  }[];
  verifiedBy?: string;
  verifiedAt?: string;     // ISO 8601
  tenantName: string;
  tenantLogoUrl?: string;
  reportHeader?: string;
  reportFooter?: string;
}
