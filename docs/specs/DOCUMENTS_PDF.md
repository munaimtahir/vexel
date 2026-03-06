# Documents + PDF Pipeline (Deterministic)

## Goal (locked)
Publishing a report/receipt must be:
- deterministic
- idempotent
- retry-safe
- scalable (async)

## Canonical payload
- Build a stable JSON payload:
  - sorted keys
  - stable ordering of arrays
  - normalized strings/numbers
- Compute `payloadHash = sha256(canonical_json)`.

## Document identity (DB)
Unique key:
(tenantId, encounterId, docType, templateVersion, payloadHash)

## Render flow (async)
1) API creates/gets Document row (idempotent) with status QUEUED.
2) API enqueues job: {documentId, tenantId}.
3) Worker loads Document + payload, calls PDF service.
4) Worker stores bytes (LOCAL now; S3 later), computes `pdfHash`.
5) Worker updates Document: status RENDERED + `pdfHash` + storageKey.
6) On failure: status FAILED + errorCode/errorMessage (audited).

## Storage backend
- MVP: LOCAL filesystem
- Later: S3/MinIO (same interface; no refactor in business logic)

## Trigger Rule (Option A)

- **Generate**: Triggered manually by operator when encounter status is `verified`.
  - Builds canonical `LabReportPayload` from encounter + patient + lab orders + results.
  - Computes `payloadHash`; idempotent: same encounter + same results = same document.
  - Enqueues `document-render` BullMQ job.
- **Publish**: Triggered manually by operator after document status is `RENDERED`.
  - Marks document `PUBLISHED`. Idempotent.
- Automatic regeneration: if lab results change before PUBLISHED, a new payloadHash is computed and a new Document record is created (previous remains in DB as historical artifact).

---

## Receipt PDF Layouts (receipt_v1 template)

The `receipt_v1` template supports two physical layouts, selected by
`BrandingConfig.ReceiptLayout` (`"a4"` | `"thermal"`).

### Thermal (80 mm roll)

- Page size: 80 mm × 200 mm (auto-height)
- Margin: 3 mm all sides
- Default font: 7 pt
- Content: compact single-column — header → patient info → items → totals
  → barcode → footer
- Intended for thermal receipt printers (58 mm / 80 mm rolls).

### A4 (standard paper) — **canonical layout**

A4 page (210 × 297 mm) with 6 mm top/bottom margins and 8 mm left/right
margins.  The printable content area is therefore **285 mm** tall.

The page is divided into **three vertical bands**:

| Band | Proportion | Height | Content |
|------|-----------|--------|---------|
| Top copy | **48 %** | ≈ 137 mm | **PATIENT COPY** — full receipt |
| Tear strip | **4 %** | ≈ 11 mm | Dotted perforated tear line with scissors icon |
| Bottom copy | **48 %** | ≈ 137 mm | **OFFICE COPY** — exact duplicate of patient copy |

#### Patient / Office copy contents (identical)

Each half is a bordered box containing:

1. **Copy label** — "PATIENT COPY" or "OFFICE COPY" (bold, centered)
2. **Header** — logo (if present) + brand name + address line
3. **Divider** — thin horizontal rule
4. **Title** — "PAYMENT RECEIPT" (bold, centered)
5. **Info block** — MRN, Order ID, Patient name, Date, Age/Gender, Receipt No.
6. **Items table** — Test Name | Price (with minimum blank rows for visual spacing)
7. **Totals** — Subtotal, Discount (if > 0), Payable (bold), Paid, Due
8. **Payment method** — "Paid by: \<method\>"
9. **Barcode** — CODE-128 barcode of the encounter code (if present)
10. **Footer** — configurable footer text

#### Tear strip (dotted line)

The 11 mm strip between the two copies renders a dashed perforation line:

```
✂ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ TEAR HERE ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ✂
```

- Uses repeated Unicode dash characters (─ U+2500) in a horizontal row
  layout with a centered **"TEAR HERE"** label between two scissors icons (✂ U+2702)
- Color: `Colors.Grey.Medium`
- The strip height (≈ 11 mm) is reserved so both copies each occupy exactly
  48 % of the printable page height.

