import {
  validateFamilySchemaCompatibility,
  isFamilyCompatibleWithSchema,
  FAMILY_SCHEMA_COMPATIBILITY,
  IMPLEMENTED_FAMILIES,
  TEMPLATE_FAMILIES,
  RESULT_SCHEMA_TYPES,
  validateGraphicalScaleConfig,
  resolveInterpretationBand,
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

// ─── GraphicalScaleConfig validation ─────────────────────────────────────────

const VALID_LIPID_CONFIG = {
  title: 'Lipid Profile',
  subtitle: 'CV Risk Panel',
  showDemographics: true,
  showInterpretationSummary: true,
  scaleStyle: 'BAND_HIGHLIGHT',
  parameters: [
    {
      key: 'total_cholesterol',
      label: 'Total Cholesterol',
      unit: 'mg/dL',
      sourceMode: 'parameter_name_match',
      sourceMatch: 'Total Cholesterol',
      bands: [
        { label: 'Desirable', min: null, max: 200, colorToken: 'GOOD' },
        { label: 'Borderline', min: 200, max: 240, colorToken: 'CAUTION' },
        { label: 'High', min: 240, max: null, colorToken: 'BAD' },
      ],
    },
    {
      key: 'hdl',
      label: 'HDL',
      unit: 'mg/dL',
      sourceMode: 'parameter_name_match',
      sourceMatch: 'HDL',
      bands: [
        { label: 'Low', min: null, max: 40, colorToken: 'BAD' },
        { label: 'Normal', min: 40, max: 60, colorToken: 'CAUTION' },
        { label: 'Optimal', min: 60, max: null, colorToken: 'GOOD' },
      ],
    },
  ],
};

describe('validateGraphicalScaleConfig', () => {
  it('returns valid for a well-formed config', () => {
    const result = validateGraphicalScaleConfig(VALID_LIPID_CONFIG as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty parameters array', () => {
    const cfg = { ...VALID_LIPID_CONFIG, parameters: [] };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /parameters/.test(e.message))).toBe(true);
  });

  it('rejects duplicate parameter keys', () => {
    const cfg = {
      ...VALID_LIPID_CONFIG,
      parameters: [
        VALID_LIPID_CONFIG.parameters[0],
        { ...VALID_LIPID_CONFIG.parameters[1], key: 'total_cholesterol' },
      ],
    };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /duplicate/i.test(e.message))).toBe(true);
  });

  it('rejects parameter with too few bands', () => {
    const cfg = {
      ...VALID_LIPID_CONFIG,
      parameters: [
        { ...VALID_LIPID_CONFIG.parameters[0], bands: [{ label: 'Only', min: null, max: null, colorToken: 'GOOD' }] },
        VALID_LIPID_CONFIG.parameters[1],
      ],
    };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /band/i.test(e.message))).toBe(true);
  });

  it('rejects invalid colorToken', () => {
    const cfg = {
      ...VALID_LIPID_CONFIG,
      parameters: [
        {
          ...VALID_LIPID_CONFIG.parameters[0],
          bands: [
            { label: 'A', min: null, max: 100, colorToken: 'PURPLE' },
            { label: 'B', min: 100, max: null, colorToken: 'GOOD' },
          ],
        },
        VALID_LIPID_CONFIG.parameters[1],
      ],
    };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /colorToken/i.test(e.message))).toBe(true);
  });

  it('rejects invalid scaleStyle', () => {
    const cfg = { ...VALID_LIPID_CONFIG, scaleStyle: 'RADAR_CHART' };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /scaleStyle/i.test(e.message))).toBe(true);
  });

  it('rejects overlapping finite bands', () => {
    const cfg = {
      ...VALID_LIPID_CONFIG,
      parameters: [
        {
          ...VALID_LIPID_CONFIG.parameters[0],
          bands: [
            { label: 'A', min: 0, max: 150, colorToken: 'GOOD' },
            { label: 'B', min: 100, max: 300, colorToken: 'BAD' }, // overlaps A
          ],
        },
        VALID_LIPID_CONFIG.parameters[1],
      ],
    };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /overlap/i.test(e.message))).toBe(true);
  });

  it('rejects multiple open-low bands in one parameter', () => {
    const cfg = {
      ...VALID_LIPID_CONFIG,
      parameters: [
        {
          ...VALID_LIPID_CONFIG.parameters[0],
          bands: [
            { label: 'A', min: null, max: 100, colorToken: 'GOOD' },
            { label: 'B', min: null, max: 200, colorToken: 'CAUTION' },
            { label: 'C', min: 200, max: null, colorToken: 'BAD' },
          ],
        },
        VALID_LIPID_CONFIG.parameters[1],
      ],
    };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
  });

  it('rejects missing title', () => {
    const cfg = { ...VALID_LIPID_CONFIG, title: '' };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /title/i.test(e.message))).toBe(true);
  });

  it('rejects missing parameter key', () => {
    const cfg = {
      ...VALID_LIPID_CONFIG,
      parameters: [
        { ...VALID_LIPID_CONFIG.parameters[0], key: '' },
        VALID_LIPID_CONFIG.parameters[1],
      ],
    };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
  });

  it('rejects missing sourceMatch', () => {
    const cfg = {
      ...VALID_LIPID_CONFIG,
      parameters: [
        { ...VALID_LIPID_CONFIG.parameters[0], sourceMatch: '' },
        VALID_LIPID_CONFIG.parameters[1],
      ],
    };
    const result = validateGraphicalScaleConfig(cfg as any);
    expect(result.valid).toBe(false);
  });
});

describe('resolveInterpretationBand', () => {
  const bands = [
    { label: 'Desirable', min: null, max: 200, colorToken: 'GOOD' as const },
    { label: 'Borderline', min: 200, max: 240, colorToken: 'CAUTION' as const },
    { label: 'High', min: 240, max: null, colorToken: 'BAD' as const },
  ];

  it('resolves value in open-low band', () => {
    const result = resolveInterpretationBand(150, bands);
    expect(result?.band.label).toBe('Desirable');
  });

  it('resolves value at lower boundary of middle band', () => {
    const result = resolveInterpretationBand(200, bands);
    expect(result?.band.label).toBe('Borderline');
  });

  it('resolves value in open-high band', () => {
    const result = resolveInterpretationBand(300, bands);
    expect(result?.band.label).toBe('High');
  });

  it('returns null for empty band list', () => {
    expect(resolveInterpretationBand(150, [])).toBeNull();
  });

  it('resolves exact upper boundary of last band when it equals max', () => {
    const tightBands = [
      { label: 'Low', min: null, max: 100, colorToken: 'BAD' as const },
      { label: 'Normal', min: 100, max: 200, colorToken: 'GOOD' as const },
    ];
    // value exactly at max of last band should resolve to last band
    expect(resolveInterpretationBand(200, tightBands)?.band.label).toBe('Normal');
  });

  it('returns null for value below all bands with closed-low first band', () => {
    const closedBands = [
      { label: 'Mid', min: 50, max: 100, colorToken: 'GOOD' as const },
      { label: 'High', min: 100, max: null, colorToken: 'BAD' as const },
    ];
    expect(resolveInterpretationBand(20, closedBands)).toBeNull();
  });
});
