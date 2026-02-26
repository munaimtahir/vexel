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
  patientAge?: string;     // computed from DOB e.g. "32Y"
  patientGender?: string;
  encounterCode?: string;  // display order/lab ID e.g. "VXL-2602-001"
  registeredBy?: string;   // name of operator who registered
  items: {
    description: string;
    quantity: number;
    unitPrice: number;     // 4dp rounded
    total: number;         // 4dp rounded
  }[];
  subtotal: number;
  discount?: number;       // discount amount, show only if > 0
  tax: number;
  grandTotal: number;
  paymentMethod?: string;  // Cash | Card | Bank Transfer
  paymentComments?: string;
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
  patientAge?: string;     // computed e.g. "32Y"
  patientDob?: string;     // ISO 8601 date only
  patientGender?: string;
  encounterId: string;
  encounterCode?: string;  // display lab order ID
  orderedBy?: string;      // referring physician
  sampleReceivedAt?: string; // ISO 8601 — when specimen was collected
  reportStatus?: string;   // Provisional | Verified
  reportHeaderLayout?: string; // default | classic | minimal
  tests: {
    testCode: string;
    testName: string;
    department?: string;
    printAlone?: boolean;  // if true, test prints on its own page
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
  reportFooterImageUrl?: string; // URL to footer image
}
