import * as crypto from 'crypto';

export function canonicalJson(obj: unknown): string {
    if (obj === null || obj === undefined) return '';
    if (typeof obj !== 'object') return String(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';

    const keys = Object.keys(obj as object).sort();
    return '{' + keys.map(k => `"${k}":${canonicalJson((obj as any)[k])}`).join(',') + '}';
}

export function payloadHash(obj: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(obj)).digest('hex');
}

// ─── Receipt Payload ──────────────────────────────────────────────────────

export interface ReceiptPayload {
  issuedAt: string;        // ISO 8601
  patientDemographics: {
    displayName: string;
    ageDisplay?: string;
    gender?: string;
    mrn?: string;
    mobile?: string;
  };
  patientName?: string;
  patientMrn?: string;
  patientAge?: string;
  patientGender?: string;
  encounterCode?: string;  // display order/lab ID e.g. "VXL-2602-001"
  labOrderCode?: string;
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
