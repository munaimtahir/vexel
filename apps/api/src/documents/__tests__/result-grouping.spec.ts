/**
 * Unit tests for result grouping and ordering logic used in generateFromEncounter.
 *
 * Grouping rules (deterministic):
 * - Tests ordered by test.name ascending (locale-stable)
 * - Parameters ordered by TestParameterMapping.displayOrder ASC, then parameterNameSnapshot ASC
 * - Single-parameter tests: 1 parameter in the array (PDF renders as inline line)
 * - Multi-parameter tests: 2+ parameters (PDF renders with heading + table)
 */

// ─── Helper: mirrors the sorting logic in documents.service.ts ───────────────

interface MockMapping {
  parameterId: string;
  displayOrder?: number;
  ordering?: number;
}

interface MockResult {
  parameterId: string | null;
  parameterNameSnapshot: string | null;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: string;
  enteredAt: Date;
}

interface MockLabOrder {
  id: string;
  test: {
    name: string;
    userCode?: string;
    department?: string;
    printAlone?: boolean;
    parameterMappings: MockMapping[];
  };
  results: MockResult[];
}

function getMappingOrder(mappings: MockMapping[], parameterId: string | null): number {
  if (!parameterId) return 999;
  const m = mappings.find((m) => m.parameterId === parameterId);
  return m?.displayOrder ?? m?.ordering ?? 999;
}

function buildGroupedTests(labOrders: MockLabOrder[]) {
  return [...labOrders]
    .sort((a, b) => a.test.name.localeCompare(b.test.name))
    .map((order) => {
      const mappings = order.test.parameterMappings;
      const sortedResults = [...order.results].sort((a, b) => {
        const aOrd = getMappingOrder(mappings, a.parameterId);
        const bOrd = getMappingOrder(mappings, b.parameterId);
        if (aOrd !== bOrd) return aOrd - bOrd;
        return (a.parameterNameSnapshot ?? '').localeCompare(b.parameterNameSnapshot ?? '');
      });
      return {
        testName: order.test.name,
        parameters: sortedResults.map((r) => ({
          parameterCode: r.parameterId ?? 'result',
          parameterName: r.parameterNameSnapshot ?? 'Result',
          value: r.value,
        })),
      };
    });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('result grouping — test ordering', () => {
  it('sorts tests by name ascending', () => {
    const orders: MockLabOrder[] = [
      { id: '1', test: { name: 'Urine R/E', parameterMappings: [] }, results: [] },
      { id: '2', test: { name: 'CBC',       parameterMappings: [] }, results: [] },
      { id: '3', test: { name: 'LFT',       parameterMappings: [] }, results: [] },
    ];
    const grouped = buildGroupedTests(orders);
    expect(grouped.map((t) => t.testName)).toEqual(['CBC', 'LFT', 'Urine R/E']);
  });

  it('is stable — same input always produces same order', () => {
    const orders: MockLabOrder[] = [
      { id: 'a', test: { name: 'Zinc',    parameterMappings: [] }, results: [] },
      { id: 'b', test: { name: 'Albumin', parameterMappings: [] }, results: [] },
      { id: 'c', test: { name: 'Iron',    parameterMappings: [] }, results: [] },
    ];
    const run1 = buildGroupedTests(orders).map((t) => t.testName);
    const run2 = buildGroupedTests([...orders].reverse()).map((t) => t.testName);
    expect(run1).toEqual(run2);
    expect(run1).toEqual(['Albumin', 'Iron', 'Zinc']);
  });
});

describe('result grouping — parameter ordering', () => {
  it('sorts parameters by displayOrder', () => {
    const mappings: MockMapping[] = [
      { parameterId: 'p1', displayOrder: 3 },
      { parameterId: 'p2', displayOrder: 1 },
      { parameterId: 'p3', displayOrder: 2 },
    ];
    const results: MockResult[] = [
      { parameterId: 'p1', parameterNameSnapshot: 'Platelet',    value: '250', enteredAt: new Date() },
      { parameterId: 'p2', parameterNameSnapshot: 'Haemoglobin', value: '13.5', enteredAt: new Date() },
      { parameterId: 'p3', parameterNameSnapshot: 'WBC',         value: '8.2', enteredAt: new Date() },
    ];
    const orders: MockLabOrder[] = [
      { id: '1', test: { name: 'CBC', parameterMappings: mappings }, results },
    ];
    const [test] = buildGroupedTests(orders);
    expect(test.parameters.map((p) => p.parameterName)).toEqual([
      'Haemoglobin', 'WBC', 'Platelet',
    ]);
  });

  it('falls back to parameterNameSnapshot for tie-breaking', () => {
    const mappings: MockMapping[] = [
      { parameterId: 'p1', displayOrder: 1 },
      { parameterId: 'p2', displayOrder: 1 }, // same order — should sort by name
    ];
    const results: MockResult[] = [
      { parameterId: 'p1', parameterNameSnapshot: 'Zymogen', value: '1.0', enteredAt: new Date() },
      { parameterId: 'p2', parameterNameSnapshot: 'Alanine', value: '2.0', enteredAt: new Date() },
    ];
    const orders: MockLabOrder[] = [
      { id: '1', test: { name: 'Test', parameterMappings: mappings }, results },
    ];
    const [test] = buildGroupedTests(orders);
    expect(test.parameters.map((p) => p.parameterName)).toEqual(['Alanine', 'Zymogen']);
  });

  it('assigns order 999 to parameters without a mapping', () => {
    const mappings: MockMapping[] = [
      { parameterId: 'p1', displayOrder: 1 },
      // p2 has no mapping
    ];
    const results: MockResult[] = [
      { parameterId: 'p2', parameterNameSnapshot: 'Orphan', value: '0.5', enteredAt: new Date() },
      { parameterId: 'p1', parameterNameSnapshot: 'First',  value: '1.0', enteredAt: new Date() },
    ];
    const orders: MockLabOrder[] = [
      { id: '1', test: { name: 'T', parameterMappings: mappings }, results },
    ];
    const [test] = buildGroupedTests(orders);
    expect(test.parameters[0].parameterName).toBe('First');
    expect(test.parameters[1].parameterName).toBe('Orphan');
  });
});

describe('single vs multi-parameter rule', () => {
  it('single-parameter test produces exactly 1 parameter in the array', () => {
    const orders: MockLabOrder[] = [
      {
        id: '1',
        test: { name: 'Serum Creatinine', parameterMappings: [] },
        results: [
          { parameterId: 'p1', parameterNameSnapshot: 'Creatinine', value: '1.2', enteredAt: new Date() },
        ],
      },
    ];
    const [test] = buildGroupedTests(orders);
    expect(test.parameters).toHaveLength(1);
    expect(test.parameters[0].parameterName).toBe('Creatinine');
  });

  it('multi-parameter test (CBC) produces multiple parameters', () => {
    const mappings: MockMapping[] = [
      { parameterId: 'p1', displayOrder: 1 },
      { parameterId: 'p2', displayOrder: 2 },
      { parameterId: 'p3', displayOrder: 3 },
    ];
    const orders: MockLabOrder[] = [
      {
        id: '1',
        test: { name: 'CBC', parameterMappings: mappings },
        results: [
          { parameterId: 'p1', parameterNameSnapshot: 'Haemoglobin', value: '13.5', enteredAt: new Date() },
          { parameterId: 'p2', parameterNameSnapshot: 'WBC',         value: '8.2',  enteredAt: new Date() },
          { parameterId: 'p3', parameterNameSnapshot: 'Platelet',    value: '250',  enteredAt: new Date() },
        ],
      },
    ];
    const [test] = buildGroupedTests(orders);
    expect(test.parameters.length).toBeGreaterThanOrEqual(2);
  });

  it('Dengue (2 params IgG/IgM) is treated as multi-parameter', () => {
    const mappings: MockMapping[] = [
      { parameterId: 'p1', displayOrder: 1 },
      { parameterId: 'p2', displayOrder: 2 },
    ];
    const orders: MockLabOrder[] = [
      {
        id: '1',
        test: { name: 'Dengue', parameterMappings: mappings },
        results: [
          { parameterId: 'p1', parameterNameSnapshot: 'Dengue IgG', value: 'Negative', enteredAt: new Date() },
          { parameterId: 'p2', parameterNameSnapshot: 'Dengue IgM', value: 'Positive', enteredAt: new Date() },
        ],
      },
    ];
    const [test] = buildGroupedTests(orders);
    expect(test.parameters).toHaveLength(2);
    expect(test.parameters[0].parameterName).toBe('Dengue IgG');
    expect(test.parameters[1].parameterName).toBe('Dengue IgM');
  });

  it('empty-parameter test produces no parameters (renders as placeholder)', () => {
    const orders: MockLabOrder[] = [
      { id: '1', test: { name: 'Pending Test', parameterMappings: [] }, results: [] },
    ];
    const [test] = buildGroupedTests(orders);
    expect(test.parameters).toHaveLength(0);
  });
});

describe('combined grouping — mixed tests', () => {
  it('sorts mixed tests alphabetically and parameters by displayOrder', () => {
    const orders: MockLabOrder[] = [
      {
        id: 'creatinine',
        test: { name: 'Serum Creatinine', parameterMappings: [] },
        results: [{ parameterId: 'pc', parameterNameSnapshot: 'Creatinine', value: '1.2', enteredAt: new Date() }],
      },
      {
        id: 'cbc',
        test: {
          name: 'CBC',
          parameterMappings: [
            { parameterId: 'p1', displayOrder: 1 },
            { parameterId: 'p2', displayOrder: 2 },
          ],
        },
        results: [
          { parameterId: 'p2', parameterNameSnapshot: 'Platelet', value: '250', enteredAt: new Date() },
          { parameterId: 'p1', parameterNameSnapshot: 'Hgb',      value: '13.5', enteredAt: new Date() },
        ],
      },
      {
        id: 'lft',
        test: {
          name: 'LFT',
          parameterMappings: [
            { parameterId: 'l1', displayOrder: 1 },
            { parameterId: 'l2', displayOrder: 2 },
            { parameterId: 'l3', displayOrder: 3 },
          ],
        },
        results: [
          { parameterId: 'l3', parameterNameSnapshot: 'GGT',  value: '40', enteredAt: new Date() },
          { parameterId: 'l1', parameterNameSnapshot: 'ALT',  value: '35', enteredAt: new Date() },
          { parameterId: 'l2', parameterNameSnapshot: 'AST',  value: '28', enteredAt: new Date() },
        ],
      },
    ];

    const grouped = buildGroupedTests(orders);

    // Test order: CBC, LFT, Serum Creatinine
    expect(grouped.map((t) => t.testName)).toEqual(['CBC', 'LFT', 'Serum Creatinine']);

    // CBC params ordered by displayOrder
    expect(grouped[0].parameters.map((p) => p.parameterName)).toEqual(['Hgb', 'Platelet']);

    // LFT params ordered by displayOrder
    expect(grouped[1].parameters.map((p) => p.parameterName)).toEqual(['ALT', 'AST', 'GGT']);

    // Creatinine: 1 parameter
    expect(grouped[2].parameters).toHaveLength(1);
  });
});
