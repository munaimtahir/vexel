# Interpretation Bands

## What Are Interpretation Bands?

Interpretation bands are ordered, non-overlapping numeric ranges that classify a measured value into a named clinical category. Each band has a label, an optional lower bound, an optional upper bound, and a color token.

They are the core data structure of `GRAPHICAL_SCALE_REPORT` templates. Every configured parameter has its own independent band set.

---

## Band Structure

```json
{
  "label": "Borderline High",
  "min": 200,
  "max": 240,
  "colorToken": "CAUTION"
}
```

| Field | Value |
|-------|-------|
| `label` | Category name displayed to the clinician |
| `min` | Inclusive lower bound. `null` = no lower limit |
| `max` | Exclusive upper bound. `null` = no upper limit |
| `colorToken` | System color token (`GOOD`, `CAUTION`, `BAD`, `INFO`, `NEUTRAL`) |

---

## Range Semantics

Band containment: `value >= min && value < max`

Special cases:
- `min: null` → matches any value below `max` (open-low band)
- `max: null` → matches any value ≥ `min` (open-high band)
- The final band's `max` is **inclusive** as a boundary guard (value === max resolves to that band)

---

## Open-Ended Range Patterns

| Pattern | Meaning | Example |
|---------|---------|---------|
| `{ min: null, max: 200 }` | Any value < 200 | "Desirable cholesterol" |
| `{ min: 200, max: 240 }` | 200 ≤ value < 240 | "Borderline" |
| `{ min: 240, max: null }` | Any value ≥ 240 | "High risk" |

---

## Validation Rules

### Per parameter

- At least **2 bands** required
- At most **one open-low band** (`min: null`) per parameter
- At most **one open-high band** (`max: null`) per parameter
- For finite bands: `min` must be strictly less than `max`
- Bands must be **non-overlapping** — the validator checks all pairwise combinations

### Overlap detection algorithm

Two bands `A` and `B` overlap if:
```
A.lo < B.hi && B.lo < A.hi
```
where `lo = min ?? -Infinity` and `hi = max ?? +Infinity`.

### Common validation errors

| Error | Cause |
|-------|-------|
| `"At least 2 bands required"` | Parameter has 0 or 1 band |
| `"Only one band may have open low"` | Two bands with `min: null` |
| `"Only one band may have open high"` | Two bands with `max: null` |
| `"Band X: min must be less than max"` | min >= max for a finite band |
| `"Bands X and Y overlap"` | Overlapping ranges |
| `"Invalid colorToken"` | colorToken not in allowed set |

---

## Category Resolution

At render time, the PDF service resolves a numeric result value against the parameter's band list:

```
for each band in order:
  if value >= band.min (or band.min is null)
  AND value < band.max (or band.max is null):
    → return this band

if value equals last band's max exactly:
  → return last band (upper-inclusive guard)

otherwise → no band matched (value out of range)
```

Implementation: `apps/api/src/templates/templates-validation.ts` → `resolveInterpretationBand()`

---

## Design Guidelines

### Typical lipid profile bands

For most parameters, a 3-band structure is common:

```
[null → threshold1)  → GOOD
[threshold1 → threshold2) → CAUTION
[threshold2 → null)  → BAD
```

### HDL is inverted (higher is better)

Since bands are purely range-based (no `lowerIsBetter` flag needed), invert the tokens:

```
[null → 40)    → BAD    (Low risk)
[40 → 60)      → CAUTION
[60 → null)    → GOOD   (Optimal)
```

### Gap coverage

If you intend full coverage from -∞ to +∞, make sure one band has `min: null` and one has `max: null`. Gaps between bands will result in a "no band matched" state for values in the gap.

### Avoid medical advice beyond category labels

Band labels are category names (`"Desirable"`, `"Borderline High"`, `"High"`), not clinical recommendations. Do not embed treatment advice in labels.

---

## Limitations in This Phase

- No support for arbitrary units or non-numeric values (string result values do not match bands)
- No fuzzy matching between parameter name and `sourceMatch`
- `VALUE_MARKER` scale style is defined but not rendered (deferred)
- No AI-generated interpretation text
- No trend comparison (single encounter only)
