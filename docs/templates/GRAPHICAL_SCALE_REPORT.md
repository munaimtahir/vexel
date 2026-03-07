# GRAPHICAL_SCALE_REPORT Renderer Family

## Overview

`GRAPHICAL_SCALE_REPORT` is a deterministic renderer family for producing visual scale-based clinical PDF reports. It renders parameter values against configured colored interpretation bands, making it suitable for lipid profiles, vitamin D assessments, endocrine panels, and any test where categorical risk bands enhance clinical readability.

This family is part of the Template Registry system. It is not a charting platform or a trend viewer. It is a deterministic, band-configured, single-encounter result report.

---

## Architecture

```
CatalogTest (resultSchemaType: TABULAR)
  → TestTemplateMap (tenant-scoped)
    → PrintTemplate (templateFamily: GRAPHICAL_SCALE_REPORT)
      → resolveTemplateKey() → "graphical_scale_report_v1"
        → GraphicalScaleReportDocument (QuestPDF, .NET)
```

---

## Supported Schema Types

| Schema Type | Supported |
|-------------|-----------|
| TABULAR | ✅ Full support |
| GRAPH_SERIES | ✅ Supported (config-driven parameter resolution) |
| DESCRIPTIVE_HEMATOLOGY | ❌ Not compatible |
| HISTOPATHOLOGY | ❌ Not compatible |
| IMAGE_ATTACHMENT | ❌ Not compatible |
| MIXED_STRUCTURED | ❌ Not compatible |

---

## Scale Styles

| Style | Description | Status |
|-------|-------------|--------|
| `BAND_HIGHLIGHT` | Entire matched band is visually emphasized | ✅ Implemented |
| `VALUE_MARKER` | A marker line is placed proportionally within the scale | ⏳ Deferred |

---

## Color Tokens

Tenants choose from system-defined color tokens. Arbitrary hex colors are not allowed in v1.

| Token | Visual Meaning | Color |
|-------|---------------|-------|
| `GOOD` | Normal / optimal range | Green (#22C55E) |
| `CAUTION` | Borderline / attention warranted | Amber (#F59E0B) |
| `BAD` | Abnormal / high risk | Red (#EF4444) |
| `INFO` | Informational / contextual | Blue (#3B82F6) |
| `NEUTRAL` | No clinical significance assigned | Gray (#9CA3AF) |

---

## PDF Report Layout

The rendered PDF follows this structure:

1. **Header** — brand name, logo (if provided), report title + subtitle, contact info
2. **Demographics block** — patient name, MRN, age/gender, DOB, encounter code, issued date (controlled by `showDemographics`)
3. **Parameter sections** — one section per configured parameter, each containing:
   - Parameter label + result value with unit (value colored by matched band)
   - Horizontal band scale with all bands rendered
   - Matched band highlighted; others shown in light gray
   - Band label + range text on each segment
4. **Interpretation Summary Table** — compact table of parameter → value → unit → category (controlled by `showInterpretationSummary`)
5. **Footer** — disclaimer text, verified-by line

---

## Starter Blueprint

`bp-lipid-profile-v1` (code: `lipid_profile_visual_v1`) ships as an OOTB blueprint with 6 parameters:

- Total Cholesterol
- LDL (Low-Density Lipoprotein)
- HDL (High-Density Lipoprotein)
- Triglycerides
- Non-HDL Cholesterol *(skipIfMissing: true)*
- TC/HDL Ratio *(skipIfMissing: true)*

---

## Determinism Guarantee

Documents rendered from this family remain deterministic because:

- Template versions are immutable once ACTIVE
- `configJson` is fetched at render time by `(tenantId, templateCode, templateVersion)` — these form a stable key
- Worker looks up `PrintTemplate.configJson` before calling the PDF service
- The document payload includes `templateCode`, `templateVersion`, and `templateFamily`
- Same encounter results + same template version = same rendered bands = same PDF content intent

---

## Future Extensibility

The renderer is designed to support future test types without redesign:

- Vitamin D interpretation bands
- Ferritin / iron stores
- Endocrine category scales
- Renal function risk bands
- Cardiovascular risk scoring

All require only a new blueprint with a different `parameters` configuration.

### Planned future renderer families (not in this phase)

- `IMAGE_REPORT`
- `PERIPHERAL_FILM_REPORT`
- `HISTOPATH_NARRATIVE`
