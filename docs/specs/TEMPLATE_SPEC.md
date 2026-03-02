# Template Spec — Lab Report v2 & Receipt v1

**Version:** lab_report_v2 (v2), receipt_v1 (v1)  
**Last updated:** 2026-03-02  
**Status:** Production

---

## 1. Template Versioning

| Type | Template Key | Version | Active | Notes |
|------|-------------|---------|--------|-------|
| LAB_REPORT | `lab_report_v1` | 1 | No | Superseded by v2 — kept for re-render compat |
| LAB_REPORT | `lab_report_v2` | 2 | **Yes** | Production layout with single/multi-param rule |
| RECEIPT | `receipt_v1` | 1 | Yes | A4 dual-copy + thermal |
| OPD_INVOICE_RECEIPT | `opd_invoice_receipt_v1` | 1 | Yes | OPD billing |

**Selection rule:** `DocumentTemplate` is fetched with `orderBy: { version: 'desc' }` — highest active version wins.  
Templates are **tenant-scoped** first; fallback to `system` tenant if no tenant-specific template.

---

## 2. Grouping Rules (Lab Report)

### 2.1 Test Ordering (deterministic)

Tests in the payload `tests[]` array are sorted by the API payload builder **before** the PDF service receives them:

1. Sort by `test.name` ascending (locale-collated, stable)

No `sortOrder` field exists on `CatalogTest`. Name sort is the stable baseline.

### 2.2 Parameter Ordering (deterministic)

Within each test, parameters are sorted:

1. `TestParameterMapping.displayOrder` ascending (if mapped)
2. Then `parameterNameSnapshot` ascending (locale, stable tie-breaker)
3. Parameters with no mapping entry are assigned effective order `999` (appear last)

### 2.3 Single vs Multi-Parameter Rule (**v2 only**)

| Parameters count | Layout |
|-----------------|--------|
| **1** | **Single line item** — no test heading; prints `"{parameterName}: {value} {unit}  Ref: {range}  [flag]"` |
| **2+** | **Test heading + table** — blue section heading (`testName (testCode)`); table: Parameter \| Result \| Unit \| Reference Range \| Flag |
| **0** | Placeholder line: `"{testName}: No results"` |

#### Single-parameter examples
```
Serum Creatinine: 1.2 mg/dL  Ref: 0.7–1.3
Fasting Glucose: 98 ↑ mg/dL  Ref: 70–100
```

#### Multi-parameter examples (CBC, LFT, Dengue)
```
┌─ CBC ────────────────────────────────────────────────┐
│ Parameter      │ Result   │ Unit   │ Ref Range  │ Flag│
│ Haemoglobin    │ 10.5 ↓   │ g/dL   │ 13.0–17.0  │ L ↓ │
│ WBC Count      │ 8.2      │ 10³/μL │ 4.0–11.0   │     │
│ Platelets      │ 350      │ 10³/μL │ 150–400    │     │
└──────────────────────────────────────────────────────┘
```

### 2.4 Flag Presentation

| Flag value | Display (single-param) | Display (table) |
|-----------|----------------------|-----------------|
| `high` / `H` | value + ` ↑` (red) | `H ↑` (red) |
| `low` / `L` | value + ` ↓` (blue) | `L ↓` (blue) |
| `critical` | value (dark red) | `CRIT` (dark red) |
| `normal` / empty | value (normal) | (empty cell) |

### 2.5 Empty/Missing Results

- Tests with 0 parameters → render placeholder line (not skipped)
- `null`/missing `value` → renders as `—` (U+2014 em-dash)
- Empty `referenceRange` → omit from display (don't print "Ref: —")

---

## 3. Payload Schema

### 3.1 Lab Report Payload (`LabReportPayload`)

```typescript
interface LabReportPayload {
  reportNumber: string;          // e.g. "RPT-ABC12345"
  issuedAt: string;              // ISO 8601 — deterministic (from verify audit event)
  patientName: string;
  patientMrn: string;
  patientAge?: string;           // e.g. "35Y" — computed at issuedAt
  patientDob?: string;           // ISO 8601 date only
  patientGender?: string;
  encounterId: string;
  encounterCode?: string;        // display ID e.g. "VXL-2603-001"
  orderedBy?: string;            // referring physician
  sampleReceivedAt?: string;     // ISO 8601 — from first SpecimenItem
  reportStatus?: string;         // "Verified" | "Provisional"
  reportHeaderLayout?: string;   // "default" | "classic" | "minimal"
  tests: {
    testCode: string;            // userCode or externalId
    testName: string;
    department?: string;
    printAlone?: boolean;        // true → page break before this test
    parameters: {                // PRE-SORTED by API (displayOrder → name)
      parameterCode: string;
      parameterName: string;
      value: string;
      unit?: string;
      referenceRange?: string;
      flag?: string;             // "normal" | "high" | "low" | "critical"
    }[];
  }[];                           // PRE-SORTED by API (test name → asc)
  verifiedBy?: string;
  verifiedAt?: string;           // ISO 8601
  tenantName: string;            // injected by documents.service
  tenantLogoUrl?: string;
  reportHeader?: string;         // contact / address line
  reportFooter?: string;
  reportFooterImageUrl?: string;
}
```

**Determinism contract:**
- `issuedAt` is anchored to the verify audit event timestamp (not current time)
- No `printedAt` field in the payload (would break determinism)
- `patientAge` computed at `encounter.createdAt` (stable)
- `tests[]` and `parameters[]` are sorted deterministically by the API builder

### 3.2 Receipt Payload (`ReceiptPayload`)

```typescript
interface ReceiptPayload {
  receiptNumber: string;
  issuedAt: string;              // ISO 8601 — from encounter.createdAt
  patientName: string;
  patientMrn: string;
  patientAge?: string;
  patientGender?: string;
  encounterCode?: string;
  registeredBy?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount?: number;
  tax: number;
  grandTotal: number;
  paymentMethod?: string;
  paymentComments?: string;
  tenantName: string;
  tenantLogoUrl?: string;
  reportHeader?: string;
  reportFooter?: string;
}
```

---

## 4. PDF Layout — Lab Report v2 (A4 Portrait)

### 4.1 Page Setup
- Size: A4 (210 × 297 mm)
- Margin: 1.5 cm all sides
- Font: Lato, base size 9pt

### 4.2 Header
- Left: tenant logo (if provided)
- Centre: lab name (16pt bold, blue-darken3)
- Right: barcode (Code128, from encounterCode) + Lab Order ID + Report # + status badge

### 4.3 Patient Info Block
- 4-column key/value table (2 label + 2 value columns)
- Rows: MRN / Lab Order ID, Patient Name / Sample Received, Age+Gender / Issued Date, Referring Physician / Report Status
- Status badge: green = Verified, orange = Provisional

### 4.4 Results Section
- Tests in order received (pre-sorted by API)
- Single-parameter tests: inline line (`{name}: {value} {unit}  Ref: {range}`)
- Multi-parameter tests: blue heading row + 5-column table (Parameter / Result / Unit / Ref Range / Flag)
- `printAlone=true` on a test → page break before it
- High values displayed with ↑ in red; low with ↓ in blue; critical in dark red

### 4.5 Verification Block
- Right-aligned box: `Verified by: {name}` + `Date: {verifiedAt}`
- Shown only when `verifiedBy` is present

### 4.6 Footer
- Left: footer text or footer image (configurable via `reportFooterLayout`)
- Right: page number

---

## 5. PDF Layout — Receipt v1

### 5.1 A4 Layout (default)
- Two receipt halves per page (PATIENT COPY + OFFICE COPY), separated by a cut-line
- Each half: logo + lab name, receipt info block, test items table, totals, barcode

### 5.2 Thermal Layout (80mm)
- Activated by `receiptLayout: "thermal"` in BrandingConfig
- Single column, compact 7pt font
- Triggered by format toggle on print page or `/documents/{id}/render?format=thermal`

---

## 6. Required vs Optional Fields

| Field | Required | Notes |
|-------|----------|-------|
| `patientName` | ✅ | |
| `patientMrn` | ✅ | |
| `issuedAt` | ✅ | Must be deterministic (no runtime `now()`) |
| `tenantName` | ✅ | Injected by API, falls back to tenantId |
| `tests[]` | ✅ | May be empty array |
| `parameters[]` | ✅ | May be empty array (per test) |
| `encounterCode` | Optional | Shows barcode if present |
| `patientAge` | Optional | Computed from DOB at anchor date |
| `patientGender` | Optional | |
| `verifiedBy` | Optional | Shows verification block if present |
| `reportStatus` | Optional | Defaults to "Provisional" if absent |
| `tenantLogoUrl` | Optional | Fetched at render time |
| `reportFooterImageUrl` | Optional | Fetched at render time |

---

## 7. Operator UI — Print Flow

1. User navigates to `/lims/print/{documentId}`
2. Page fetches document metadata (status, type)
3. **If RENDERED/PUBLISHED:** loads PDF bytes from MinIO → shows in iframe → Print button enabled
4. **If QUEUED/RENDERING:** shows "⏳ Generating PDF…" overlay → polls every 3 s → auto-loads when ready
5. **If FAILED:** shows error message with guidance to re-generate from the encounter page
6. Format toggle (RECEIPT only): switches between A4 and Thermal via `/documents/{id}/render?format=thermal`
7. Download button: triggers `<a download>` from blob URL

**SDK-only:** all API calls use `getApiClient(getToken())` — no direct fetch/axios.
