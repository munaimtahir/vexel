export const TEMPLATE_FAMILIES = [
  'GENERAL_TABLE',
  'TWO_COLUMN_TABLE',
  'PERIPHERAL_FILM_REPORT',
  'HISTOPATH_NARRATIVE',
  'GRAPHICAL_SCALE_REPORT',
  'IMAGE_REPORT',
] as const;
export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];

export const RESULT_SCHEMA_TYPES = [
  'TABULAR',
  'DESCRIPTIVE_HEMATOLOGY',
  'HISTOPATHOLOGY',
  'GRAPH_SERIES',
  'IMAGE_ATTACHMENT',
  'MIXED_STRUCTURED',
] as const;
export type ResultSchemaType = (typeof RESULT_SCHEMA_TYPES)[number];

export const TEMPLATE_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

// Compatibility matrix: which families are allowed for which schema types (this phase)
export const FAMILY_SCHEMA_COMPATIBILITY: Record<TemplateFamily, ResultSchemaType[]> = {
  GENERAL_TABLE: ['TABULAR'],
  TWO_COLUMN_TABLE: ['TABULAR'],
  PERIPHERAL_FILM_REPORT: ['DESCRIPTIVE_HEMATOLOGY'],
  HISTOPATH_NARRATIVE: ['HISTOPATHOLOGY'],
  GRAPHICAL_SCALE_REPORT: ['TABULAR', 'GRAPH_SERIES'],
  IMAGE_REPORT: ['IMAGE_ATTACHMENT'],
};

// Families available for use in this phase (others are placeholders)
export const IMPLEMENTED_FAMILIES: TemplateFamily[] = ['GENERAL_TABLE', 'TWO_COLUMN_TABLE', 'GRAPHICAL_SCALE_REPORT'];

export function isFamilyCompatibleWithSchema(
  family: TemplateFamily,
  schemaType: ResultSchemaType,
): boolean {
  const allowed = FAMILY_SCHEMA_COMPATIBILITY[family];
  return allowed?.includes(schemaType) ?? false;
}

export function validateFamilySchemaCompatibility(
  family: string,
  schemaType: string,
): { valid: boolean; message?: string } {
  if (!TEMPLATE_FAMILIES.includes(family as TemplateFamily)) {
    return { valid: false, message: `Invalid templateFamily: ${family}` };
  }
  if (!RESULT_SCHEMA_TYPES.includes(schemaType as ResultSchemaType)) {
    return { valid: false, message: `Invalid schemaType: ${schemaType}` };
  }
  if (!isFamilyCompatibleWithSchema(family as TemplateFamily, schemaType as ResultSchemaType)) {
    const allowed = FAMILY_SCHEMA_COMPATIBILITY[family as TemplateFamily];
    return {
      valid: false,
      message: `Template family ${family} is not compatible with schema type ${schemaType}. Allowed schema types: ${allowed.join(', ')}`,
    };
  }
  return { valid: true };
}

// ─── Graphical Scale Report Config Types ─────────────────────────────────────

export const SCALE_STYLES = ['BAND_HIGHLIGHT', 'VALUE_MARKER'] as const;
export type ScaleStyle = (typeof SCALE_STYLES)[number];

export const COLOR_TOKENS = ['GOOD', 'CAUTION', 'BAD', 'INFO', 'NEUTRAL'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export const SOURCE_MODES = ['parameter_name_match', 'parameter_normalized_match'] as const;
export type SourceMode = (typeof SOURCE_MODES)[number];

export interface InterpretationBand {
  label: string;
  min: number | null;
  max: number | null;
  colorToken: ColorToken;
}

export interface ScaleParameter {
  key: string;
  label: string;
  unit: string;
  sourceMode: SourceMode;
  sourceMatch: string;
  bands: InterpretationBand[];
  skipIfMissing?: boolean;
}

export interface GraphicalScaleConfig {
  title?: string;
  subtitle?: string;
  showDemographics?: boolean;
  showInterpretationSummary?: boolean;
  scaleStyle?: ScaleStyle;
  parameters: ScaleParameter[];
}

export interface BandValidationError {
  parameterKey: string;
  bandIndex?: number;
  field?: string;
  message: string;
}

export interface GraphicalScaleValidationResult {
  valid: boolean;
  errors: BandValidationError[];
}

/**
 * Validates a GRAPHICAL_SCALE_REPORT configJson.
 * Returns all errors (not just the first) for better UX.
 */
export function validateGraphicalScaleConfig(config: unknown): GraphicalScaleValidationResult {
  const errors: BandValidationError[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: [{ parameterKey: '', message: 'configJson must be an object' }] };
  }

  const cfg = config as Record<string, unknown>;

  if (cfg.scaleStyle !== undefined && !SCALE_STYLES.includes(cfg.scaleStyle as ScaleStyle)) {
    errors.push({ parameterKey: '', field: 'scaleStyle', message: `Invalid scaleStyle: ${cfg.scaleStyle}. Allowed: ${SCALE_STYLES.join(', ')}` });
  }

  if (cfg.title !== undefined && (typeof cfg.title !== 'string' || cfg.title.trim() === '')) {
    errors.push({ parameterKey: '', field: 'title', message: 'title must be a non-empty string when provided' });
  }

  if (!Array.isArray(cfg.parameters) || cfg.parameters.length === 0) {
    errors.push({ parameterKey: '', field: 'parameters', message: 'parameters must be a non-empty array' });
    return { valid: false, errors };
  }

  const seenKeys = new Set<string>();

  for (let pi = 0; pi < cfg.parameters.length; pi++) {
    const param = cfg.parameters[pi] as Record<string, unknown>;
    const key = String(param.key ?? `[${pi}]`);

    if (!param.key || typeof param.key !== 'string' || param.key.trim() === '') {
      errors.push({ parameterKey: key, field: 'key', message: `Parameter ${pi}: key is required` });
    } else if (seenKeys.has(param.key)) {
      errors.push({ parameterKey: key, field: 'key', message: `Duplicate parameter key: ${param.key}` });
    } else {
      seenKeys.add(param.key);
    }

    if (!param.label || typeof param.label !== 'string') {
      errors.push({ parameterKey: key, field: 'label', message: `Parameter ${key}: label is required` });
    }
    if (param.sourceMode && !SOURCE_MODES.includes(param.sourceMode as SourceMode)) {
      errors.push({ parameterKey: key, field: 'sourceMode', message: `Parameter ${key}: invalid sourceMode ${param.sourceMode}` });
    }
    if (!param.sourceMatch || typeof param.sourceMatch !== 'string') {
      errors.push({ parameterKey: key, field: 'sourceMatch', message: `Parameter ${key}: sourceMatch is required` });
    }

    if (!Array.isArray(param.bands) || param.bands.length < 2) {
      errors.push({ parameterKey: key, field: 'bands', message: `Parameter ${key}: must have at least 2 bands` });
      continue;
    }

    const bandErrors = validateBands(key, param.bands as InterpretationBand[]);
    errors.push(...bandErrors);
  }

  return { valid: errors.length === 0, errors };
}

function validateBands(paramKey: string, bands: InterpretationBand[]): BandValidationError[] {
  const errors: BandValidationError[] = [];
  let openLowCount = 0;
  let openHighCount = 0;

  for (let bi = 0; bi < bands.length; bi++) {
    const band = bands[bi];
    if (!band.label || typeof band.label !== 'string') {
      errors.push({ parameterKey: paramKey, bandIndex: bi, field: 'label', message: `Band ${bi}: label is required` });
    }
    if (!COLOR_TOKENS.includes(band.colorToken)) {
      errors.push({ parameterKey: paramKey, bandIndex: bi, field: 'colorToken', message: `Band ${bi}: invalid colorToken ${band.colorToken}` });
    }
    if (band.min === null && band.max === null) {
      errors.push({ parameterKey: paramKey, bandIndex: bi, message: `Band ${bi}: min and max cannot both be null` });
    }
    if (band.min !== null && band.max !== null && band.min >= band.max) {
      errors.push({ parameterKey: paramKey, bandIndex: bi, message: `Band ${bi}: min (${band.min}) must be less than max (${band.max})` });
    }
    if (band.min === null) openLowCount++;
    if (band.max === null) openHighCount++;
  }

  if (openLowCount > 1) {
    errors.push({ parameterKey: paramKey, message: `Parameter has ${openLowCount} open-low bands (null min); at most 1 allowed` });
  }
  if (openHighCount > 1) {
    errors.push({ parameterKey: paramKey, message: `Parameter has ${openHighCount} open-high bands (null max); at most 1 allowed` });
  }

  // Check for overlapping ranges
  const overlapErrors = checkBandOverlap(paramKey, bands);
  errors.push(...overlapErrors);

  return errors;
}

function checkBandOverlap(paramKey: string, bands: InterpretationBand[]): BandValidationError[] {
  const errors: BandValidationError[] = [];
  // Only check finite-bounded pairs; open-ended segments are assumed non-overlapping by design
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const a = bands[i];
      const b = bands[j];
      if (a.min === null || a.max === null || b.min === null || b.max === null) continue;
      if (a.min < b.max && b.min < a.max) {
        errors.push({
          parameterKey: paramKey,
          message: `Band ${i} (${a.min}–${a.max}) overlaps with band ${j} (${b.min}–${b.max})`,
        });
      }
    }
  }
  return errors;
}

/**
 * Given a numeric value and a set of bands, returns the matching band label and colorToken.
 * Bands with null min are treated as -Infinity; null max as +Infinity.
 */
export function resolveInterpretationBand(
  value: number,
  bands: InterpretationBand[],
): { band: InterpretationBand; bandIndex: number } | null {
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const lo = band.min ?? -Infinity;
    const hi = band.max ?? Infinity;
    if (value >= lo && value < hi) return { band, bandIndex: i };
  }
  // Inclusive check for the last band's max
  const last = bands[bands.length - 1];
  if (last && last.max !== null && value === last.max) return { band: last, bandIndex: bands.length - 1 };
  return null;
}
