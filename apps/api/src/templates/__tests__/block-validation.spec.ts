import { validateLayout, sanitizeLayoutSecurity, MAX_LAYOUT_BLOCKS, MAX_LAYOUT_BYTES, HybridLayout, LayoutBlock } from '../blocks';

const validBlock = (id = 'header1', type: LayoutBlock['type'] = 'HEADER'): LayoutBlock => ({
  id,
  type,
  props: { showLogo: true, title: 'My Report' },
});

const minimalLayout = (): HybridLayout => ({
  page: { size: 'A4', margin: 24 },
  blocks: [validBlock()],
});

describe('validateLayout', () => {
  it('accepts a valid single-block layout', () => {
    const result = validateLayout(minimalLayout());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts all 10 standard block types as recognized types', () => {
    const types = ['HEADER','DEMOGRAPHICS','PARAMETER_TABLE','NARRATIVE_SECTION','GRAPH_SCALE','IMAGE_GRID','SIGNATURE_BLOCK','DISCLAIMER','SPACER','SECTION_TITLE'];
    for (const type of types) {
      const r = validateLayout({ page: { size: 'A4', margin: 24 }, blocks: [{ id: `b1`, type, props: {} }] });
      // Block type must be recognized — no "unknown block type" error
      expect(r.errors.some(e => e.message.toLowerCase().includes('unknown'))).toBe(false);
    }
  });

  it('rejects null input', () => {
    const result = validateLayout(null);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'root')).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateLayout('string').valid).toBe(false);
    expect(validateLayout(42).valid).toBe(false);
    expect(validateLayout([]).valid).toBe(false);
  });

  it('rejects missing page property', () => {
    const result = validateLayout({ blocks: [validBlock()] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'page')).toBe(true);
  });

  it('rejects missing blocks property', () => {
    const result = validateLayout({ page: { size: 'A4', margin: 24 } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'blocks')).toBe(true);
  });

  it('rejects non-array blocks', () => {
    const result = validateLayout({ page: { size: 'A4', margin: 24 }, blocks: 'not-an-array' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'blocks')).toBe(true);
  });

  it('rejects duplicate block IDs', () => {
    const layout = {
      page: { size: 'A4', margin: 24 },
      blocks: [validBlock('dup'), validBlock('dup')],
    };
    const result = validateLayout(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.toLowerCase().includes('duplicate'))).toBe(true);
  });

  it('rejects unknown block types', () => {
    const layout = {
      page: { size: 'A4', margin: 24 },
      blocks: [{ id: 'b1', type: 'UNKNOWN_BLOCK', props: {} }],
    };
    const result = validateLayout(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.toLowerCase().includes('unknown'))).toBe(true);
  });

  it(`rejects layouts exceeding ${MAX_LAYOUT_BLOCKS} blocks`, () => {
    const blocks = Array.from({ length: MAX_LAYOUT_BLOCKS + 1 }, (_, i) => ({
      id: `b${i}`, type: 'SPACER', props: {},
    }));
    const result = validateLayout({ page: { size: 'A4', margin: 24 }, blocks });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.toLowerCase().includes('maximum'))).toBe(true);
  });

  it('rejects oversized layout JSON', () => {
    const hugeTitle = 'x'.repeat(MAX_LAYOUT_BYTES + 1);
    const layout = {
      page: { size: 'A4', margin: 24 },
      blocks: [{ id: 'b1', type: 'HEADER', props: { title: hugeTitle } }],
    };
    const result = validateLayout(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.toLowerCase().includes('size'))).toBe(true);
  });

  it('rejects blocks with missing id', () => {
    const result = validateLayout({
      page: { size: 'A4', margin: 24 },
      blocks: [{ type: 'HEADER', props: {} }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.blockIndex === 0)).toBe(true);
  });

  it('rejects blocks with empty id', () => {
    const result = validateLayout({
      page: { size: 'A4', margin: 24 },
      blocks: [{ id: '', type: 'HEADER', props: {} }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects blocks with missing props', () => {
    const result = validateLayout({
      page: { size: 'A4', margin: 24 },
      blocks: [{ id: 'b1', type: 'HEADER' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field?.includes('props'))).toBe(true);
  });

  it('allows valid page margin range', () => {
    for (const margin of [8, 24, 72]) {
      const result = validateLayout({ page: { size: 'A4', margin }, blocks: [] });
      expect(result.valid).toBe(true);
    }
  });

  it('rejects page margin outside valid range', () => {
    const result = validateLayout({ page: { size: 'A4', margin: 2 }, blocks: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field?.includes('margin'))).toBe(true);
  });
});

describe('sanitizeLayoutSecurity', () => {
  it('allows clean layout', () => {
    const result = sanitizeLayoutSecurity(minimalLayout());
    expect(result.safe).toBe(true);
  });

  it('rejects layout containing <script>', () => {
    const layout = { ...minimalLayout() };
    (layout as any).blocks[0].props.title = '<script>alert(1)</script>';
    const result = sanitizeLayoutSecurity(layout);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('<script');
  });

  it('rejects javascript: URLs', () => {
    const layout = { ...minimalLayout() };
    (layout as any).blocks[0].props.src = 'javascript:void(0)';
    const result = sanitizeLayoutSecurity(layout);
    expect(result.safe).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('javascript:');
  });

  it('rejects on-event handler strings', () => {
    const layout = { ...minimalLayout() };
    (layout as any).blocks[0].props.text = 'onclick=alert(1)';
    const result = sanitizeLayoutSecurity(layout);
    expect(result.safe).toBe(false);
  });

  it('allows normal text content', () => {
    const layout = { ...minimalLayout() };
    (layout as any).blocks[0].props.title = 'Lab Report — Lipid Panel';
    const result = sanitizeLayoutSecurity(layout);
    expect(result.safe).toBe(true);
  });

  it('allows unicode and special chars in text', () => {
    const layout = { ...minimalLayout() };
    (layout as any).blocks[0].props.title = 'Rapport de Laboratoire — پاکستان';
    const result = sanitizeLayoutSecurity(layout);
    expect(result.safe).toBe(true);
  });
});
