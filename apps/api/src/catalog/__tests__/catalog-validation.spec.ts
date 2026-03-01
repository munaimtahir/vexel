import { normalizeCatalogName, normalizeUnit, parseReferenceRangeExpression } from '../catalog-validation';

describe('catalog-validation', () => {
  it('normalizes names by trimming and collapsing spaces', () => {
    expect(normalizeCatalogName('  Whole   Blood  ')).toBe('Whole Blood');
  });

  it('normalizes known unit aliases', () => {
    expect(normalizeUnit('mgdl')).toBe('mg/dL');
    expect(normalizeUnit('MMOL/L')).toBe('mmol/L');
  });

  it('parses supported range expressions', () => {
    expect(parseReferenceRangeExpression('70-110')).toEqual({ kind: 'between', low: 70, high: 110 });
    expect(parseReferenceRangeExpression('<5')).toEqual({ kind: 'lt', value: 5 });
    expect(parseReferenceRangeExpression('≥3.2')).toEqual({ kind: 'gte', value: 3.2 });
  });
});
