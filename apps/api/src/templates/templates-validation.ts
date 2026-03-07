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
  GRAPHICAL_SCALE_REPORT: ['GRAPH_SERIES'],
  IMAGE_REPORT: ['IMAGE_ATTACHMENT'],
};

// Families available for use in this phase (others are placeholders)
export const IMPLEMENTED_FAMILIES: TemplateFamily[] = ['GENERAL_TABLE', 'TWO_COLUMN_TABLE'];

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
