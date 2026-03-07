import {
  validateFamilySchemaCompatibility,
  isFamilyCompatibleWithSchema,
  FAMILY_SCHEMA_COMPATIBILITY,
  IMPLEMENTED_FAMILIES,
  TEMPLATE_FAMILIES,
  RESULT_SCHEMA_TYPES,
} from '../templates-validation';

describe('templates-validation', () => {
  describe('validateFamilySchemaCompatibility', () => {
    it('returns valid for GENERAL_TABLE + TABULAR', () => {
      const result = validateFamilySchemaCompatibility('GENERAL_TABLE', 'TABULAR');
      expect(result.valid).toBe(true);
    });

    it('returns valid for TWO_COLUMN_TABLE + TABULAR', () => {
      const result = validateFamilySchemaCompatibility('TWO_COLUMN_TABLE', 'TABULAR');
      expect(result.valid).toBe(true);
    });

    it('returns invalid for GENERAL_TABLE + HISTOPATHOLOGY', () => {
      const result = validateFamilySchemaCompatibility('GENERAL_TABLE', 'HISTOPATHOLOGY');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('GENERAL_TABLE');
      expect(result.message).toContain('HISTOPATHOLOGY');
    });

    it('returns invalid for unknown family', () => {
      const result = validateFamilySchemaCompatibility('UNKNOWN_FAMILY', 'TABULAR');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid templateFamily');
    });

    it('returns invalid for unknown schema type', () => {
      const result = validateFamilySchemaCompatibility('GENERAL_TABLE', 'UNKNOWN_SCHEMA');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid schemaType');
    });

    it('returns valid for PERIPHERAL_FILM_REPORT + DESCRIPTIVE_HEMATOLOGY', () => {
      const result = validateFamilySchemaCompatibility('PERIPHERAL_FILM_REPORT', 'DESCRIPTIVE_HEMATOLOGY');
      expect(result.valid).toBe(true);
    });

    it('returns invalid for PERIPHERAL_FILM_REPORT + TABULAR (wrong schema)', () => {
      const result = validateFamilySchemaCompatibility('PERIPHERAL_FILM_REPORT', 'TABULAR');
      expect(result.valid).toBe(false);
    });

    it('returns valid for HISTOPATH_NARRATIVE + HISTOPATHOLOGY', () => {
      const result = validateFamilySchemaCompatibility('HISTOPATH_NARRATIVE', 'HISTOPATHOLOGY');
      expect(result.valid).toBe(true);
    });
  });

  describe('isFamilyCompatibleWithSchema', () => {
    it('correctly identifies compatible pairs', () => {
      expect(isFamilyCompatibleWithSchema('GENERAL_TABLE', 'TABULAR')).toBe(true);
      expect(isFamilyCompatibleWithSchema('TWO_COLUMN_TABLE', 'TABULAR')).toBe(true);
      expect(isFamilyCompatibleWithSchema('GRAPHICAL_SCALE_REPORT', 'GRAPH_SERIES')).toBe(true);
      expect(isFamilyCompatibleWithSchema('IMAGE_REPORT', 'IMAGE_ATTACHMENT')).toBe(true);
    });

    it('correctly rejects incompatible pairs', () => {
      expect(isFamilyCompatibleWithSchema('GENERAL_TABLE', 'HISTOPATHOLOGY')).toBe(false);
      expect(isFamilyCompatibleWithSchema('TWO_COLUMN_TABLE', 'GRAPH_SERIES')).toBe(false);
      expect(isFamilyCompatibleWithSchema('HISTOPATH_NARRATIVE', 'TABULAR')).toBe(false);
    });
  });

  describe('FAMILY_SCHEMA_COMPATIBILITY matrix', () => {
    it('covers all template families', () => {
      for (const family of TEMPLATE_FAMILIES) {
        expect(FAMILY_SCHEMA_COMPATIBILITY[family]).toBeDefined();
        expect(Array.isArray(FAMILY_SCHEMA_COMPATIBILITY[family])).toBe(true);
        expect(FAMILY_SCHEMA_COMPATIBILITY[family].length).toBeGreaterThan(0);
      }
    });

    it('only references valid schema types', () => {
      for (const family of TEMPLATE_FAMILIES) {
        for (const schemaType of FAMILY_SCHEMA_COMPATIBILITY[family]) {
          expect(RESULT_SCHEMA_TYPES).toContain(schemaType);
        }
      }
    });
  });

  describe('IMPLEMENTED_FAMILIES', () => {
    it('contains GENERAL_TABLE and TWO_COLUMN_TABLE', () => {
      expect(IMPLEMENTED_FAMILIES).toContain('GENERAL_TABLE');
      expect(IMPLEMENTED_FAMILIES).toContain('TWO_COLUMN_TABLE');
    });

    it('is a subset of TEMPLATE_FAMILIES', () => {
      for (const f of IMPLEMENTED_FAMILIES) {
        expect(TEMPLATE_FAMILIES).toContain(f);
      }
    });
  });
});
