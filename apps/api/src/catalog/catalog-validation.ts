export type ParsedReferenceRange =
  | { kind: 'between'; low: number; high: number }
  | { kind: 'lt'; value: number }
  | { kind: 'lte'; value: number }
  | { kind: 'gt'; value: number }
  | { kind: 'gte'; value: number };

const UNIT_ALIASES: Record<string, string> = {
  'mgdl': 'mg/dL',
  'mg/dl': 'mg/dL',
  'mmoll': 'mmol/L',
  'mmol/l': 'mmol/L',
  'gdl': 'g/dL',
  'g/dl': 'g/dL',
  '%': '%',
  'iu/l': 'IU/L',
};

export function normalizeCatalogName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeUnit(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const canonical = UNIT_ALIASES[trimmed.toLowerCase()];
  return canonical ?? trimmed;
}

export function parseReferenceRangeExpression(input?: string | null): ParsedReferenceRange | null {
  if (!input) return null;
  const normalized = input
    .replace(/\s+/g, '')
    .replace(/[–—−]/g, '-')
    .replace('≤', '<=')
    .replace('≥', '>=');
  const between = normalized.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
  if (between) return { kind: 'between', low: Number(between[1]), high: Number(between[2]) };
  const lt = normalized.match(/^<(-?\d+(?:\.\d+)?)$/);
  if (lt) return { kind: 'lt', value: Number(lt[1]) };
  const lte = normalized.match(/^<=(-?\d+(?:\.\d+)?)$/);
  if (lte) return { kind: 'lte', value: Number(lte[1]) };
  const gt = normalized.match(/^>(-?\d+(?:\.\d+)?)$/);
  if (gt) return { kind: 'gt', value: Number(gt[1]) };
  const gte = normalized.match(/^>=(-?\d+(?:\.\d+)?)$/);
  if (gte) return { kind: 'gte', value: Number(gte[1]) };
  return null;
}
