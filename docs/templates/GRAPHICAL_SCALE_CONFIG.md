# Graphical Scale Config Format

## Overview

`GRAPHICAL_SCALE_REPORT` templates are configured via a structured JSON document (`configJson`) stored in `PrintTemplate.configJson`. This config controls every visual aspect of the rendered report without any hardcoded per-test logic.

---

## Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | No* | `"Graphical Report"` | Report title displayed in header |
| `subtitle` | string | No | `""` | Secondary header line |
| `showDemographics` | boolean | No | `true` | Show patient demographics block |
| `showInterpretationSummary` | boolean | No | `true` | Show summary table at bottom |
| `scaleStyle` | enum | No | `"BAND_HIGHLIGHT"` | Visual style of scale bar |
| `parameters` | array | **Yes** | — | List of scale parameters to render |

*`title` must be non-empty if provided. An empty string is rejected by validation.

---

## `parameters` Array Item

Each entry describes one parameter to render on the scale report.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | **Yes** | Unique identifier within this template (e.g. `"total_cholesterol"`) |
| `label` | string | **Yes** | Display label on the report (e.g. `"Total Cholesterol"`) |
| `unit` | string | **Yes** | Unit string (e.g. `"mg/dL"`) |
| `sourceMode` | enum | **Yes** | How to match result data — see Source Modes |
| `sourceMatch` | string | **Yes** | Matching value (parameter name, normalized name, etc.) |
| `skipIfMissing` | boolean | No | If `true`, parameter is silently skipped if not found in results |
| `bands` | array | **Yes** | Interpretation bands — at least 2 required |

---

## `bands` Array Item

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | **Yes** | Display label for this band (e.g. `"Desirable"`, `"High"`) |
| `min` | number \| null | **Yes** | Lower bound (inclusive). `null` = open low (−∞) |
| `max` | number \| null | **Yes** | Upper bound (exclusive). `null` = open high (+∞) |
| `colorToken` | enum | **Yes** | System color token — see Color Tokens |

### Open-ended ranges

| Pattern | Meaning |
|---------|---------|
| `{ min: null, max: 200 }` | value < 200 |
| `{ min: 200, max: 240 }` | 200 ≤ value < 240 |
| `{ min: 240, max: null }` | value ≥ 240 |

---

## Source Modes

| Value | Behavior |
|-------|----------|
| `parameter_name_match` | Match by `parameterName` field in result data (exact then case-insensitive fallback) |
| `parameter_normalized_match` | Match by normalized name (whitespace/punctuation-insensitive) — partially supported |

---

## Scale Styles

| Value | Description |
|-------|-------------|
| `BAND_HIGHLIGHT` | Entire matching band cell is colored with token color |
| `VALUE_MARKER` | Marker placed proportionally on scale (deferred — use `BAND_HIGHLIGHT` for now) |

---

## Color Tokens

| Token | Description |
|-------|-------------|
| `GOOD` | Positive / normal — green |
| `CAUTION` | Borderline / attention — amber |
| `BAD` | Abnormal / high risk — red |
| `INFO` | Informational — blue |
| `NEUTRAL` | No assignment — gray |

---

## Full Example

```json
{
  "title": "Lipid Profile",
  "subtitle": "Cardiovascular Risk Indicator Panel",
  "showDemographics": true,
  "showInterpretationSummary": true,
  "scaleStyle": "BAND_HIGHLIGHT",
  "parameters": [
    {
      "key": "total_cholesterol",
      "label": "Total Cholesterol",
      "unit": "mg/dL",
      "sourceMode": "parameter_name_match",
      "sourceMatch": "Total Cholesterol",
      "bands": [
        { "label": "Desirable", "min": null, "max": 200, "colorToken": "GOOD" },
        { "label": "Borderline High", "min": 200, "max": 240, "colorToken": "CAUTION" },
        { "label": "High", "min": 240, "max": null, "colorToken": "BAD" }
      ]
    },
    {
      "key": "hdl",
      "label": "HDL (High-Density Lipoprotein)",
      "unit": "mg/dL",
      "sourceMode": "parameter_name_match",
      "sourceMatch": "HDL",
      "bands": [
        { "label": "Low (Risk)", "min": null, "max": 40, "colorToken": "BAD" },
        { "label": "Acceptable", "min": 40, "max": 60, "colorToken": "CAUTION" },
        { "label": "Optimal", "min": 60, "max": null, "colorToken": "GOOD" }
      ]
    }
  ]
}
```

---

## Validation Rules (enforced at save and preview)

- `parameters` must be a non-empty array
- Each `key` must be unique within the template
- Each parameter must have `key`, `label`, `sourceMatch`
- Each parameter must have at least 2 bands
- `colorToken` must be one of: `GOOD`, `CAUTION`, `BAD`, `INFO`, `NEUTRAL`
- `scaleStyle` must be one of: `BAND_HIGHLIGHT`, `VALUE_MARKER`
- `title` must be non-empty if provided
- Bands must be non-overlapping (validated via `checkBandOverlap`)
- At most one open-low band (`min: null`) per parameter
- At most one open-high band (`max: null`) per parameter

See `apps/api/src/templates/templates-validation.ts` → `validateGraphicalScaleConfig()`.

---

## Tenant Customization Allowed

Tenants **may** edit:
- `title`, `subtitle`
- `showDemographics`, `showInterpretationSummary`
- `scaleStyle`
- parameter `label`, `unit`, `sourceMatch`
- band `label`, color tokens
- add/remove/reorder parameters and bands
- `skipIfMissing` flag

Tenants **may not**:
- Define arbitrary hex colors (use tokens only)
- Override renderer engine behavior
- Use unsupported source modes beyond `parameter_name_match`

---

## Missing Parameter Handling

If `skipIfMissing: true` and the parameter is not found in the result data, the parameter section is omitted silently.

If `skipIfMissing: false` (default), the parameter section renders with `—` as the value and no band is highlighted.

The summary table reflects the same logic.
