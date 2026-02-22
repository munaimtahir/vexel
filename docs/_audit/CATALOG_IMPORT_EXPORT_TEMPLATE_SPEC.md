# Catalog Import/Export Template Specification

## Workbook Structure
One XLSX workbook with 5 sheets. Sheets processed in order:
1. Parameters
2. Tests
3. Panels
4. TestParameters
5. PanelTests

Import modes:
- `CREATE_ONLY`: reject if externalId already exists for this tenant
- `UPSERT_PATCH` (default): update only provided fields; blank = no change; `__CLEAR__` = set null

## Sheet 1: Parameters

| Column | Type | Required | Notes |
|---|---|---|---|
| externalId | string | YES (import key) | Tenant-scoped unique. Used for upsert identity |
| userCode | string | no | Tenant-scoped unique. Daily-use lab code (e.g. HB, ALT) |
| name | string | YES | Display name |
| resultType | enum | YES | numeric \| text \| boolean \| enum |
| defaultUnit | string | conditional | UCUM string. REQUIRED if resultType=numeric |
| decimals | integer | no | Decimal places for numeric results |
| allowedValues | string | no | Pipe-separated values for enum type (e.g. Positive\|Negative) |
| loincCode | string | no | LOINC code (format: NNNNN-N) |
| code | string | no | Legacy internal short code |
| isActive | boolean | no | Default: true |

Example row:
```
externalId: PARAM-HB
userCode: HB
name: Hemoglobin
resultType: numeric
defaultUnit: g/dL
decimals: 1
loincCode: 718-7
isActive: true
```

## Sheet 2: Tests

| Column | Type | Required | Notes |
|---|---|---|---|
| externalId | string | YES | Tenant-scoped unique |
| userCode | string | no | Tenant-scoped unique |
| name | string | YES | |
| code | string | no | |
| department | string | no | e.g. Hematology, Biochemistry |
| specimenType | string | no | e.g. Blood, Urine |
| method | string | no | e.g. Flow Cytometry, ELISA |
| turnaroundHours | integer | no | Expected TAT in hours |
| loincCode | string | no | |
| isActive | boolean | no | Default: true |

## Sheet 3: Panels

| Column | Type | Required | Notes |
|---|---|---|---|
| externalId | string | YES | Tenant-scoped unique |
| userCode | string | no | Tenant-scoped unique |
| name | string | YES | |
| code | string | no | |
| loincCode | string | no | |
| isActive | boolean | no | Default: true |

## Sheet 4: TestParameters

| Column | Type | Required | Notes |
|---|---|---|---|
| testExternalId | string | YES | Must match existing test |
| parameterExternalId | string | YES | Must match existing parameter |
| displayOrder | integer | YES | 1-based ordering within test |
| isRequired | boolean | no | Default: true |
| unitOverride | string | no | UCUM override for this mapping |

## Sheet 5: PanelTests

| Column | Type | Required | Notes |
|---|---|---|---|
| panelExternalId | string | YES | Must match existing panel |
| testExternalId | string | YES | Must match existing test |
| displayOrder | integer | YES | 1-based ordering within panel |

## Patch Semantics

### UPSERT_PATCH behavior
- Row with matching externalId: update ONLY columns that have a non-blank value
- Blank cell = "not provided" — existing value is preserved
- `__CLEAR__` in any cell = explicitly set that field to null/empty
- New externalId (not found in tenant): create new record

### Example: updating only one field
Current parameter PARAM-HB: { name: "Hemoglobin", defaultUnit: "g/dL", decimals: 2 }
Import row: { externalId: "PARAM-HB", decimals: 1, [all others blank] }
Result: { name: "Hemoglobin", defaultUnit: "g/dL", decimals: 1 }  ← only decimals updated

### Example: clearing a field
Import row: { externalId: "PARAM-HB", loincCode: "__CLEAR__" }
Result: loincCode is set to null

## Validation Rules
- externalId: required, string, no special chars except - and _
- resultType: must be one of: numeric, text, boolean, enum
- defaultUnit: if resultType=numeric, must be non-empty UCUM-like string
- loincCode: if present, must match pattern /^\d{1,5}-\d$/
- displayOrder: must be positive integer, unique within test/panel
- userCode: if present, must be unique within tenant (checked during import)

## Error Format (errors download)
CSV with columns: sheet, row, column, externalId, errorCode, errorMessage

## Idempotency
sha256(fileBytes) + tenantId + mode + options → idempotency key
Re-running the exact same file produces the same job (no duplicate creates).
