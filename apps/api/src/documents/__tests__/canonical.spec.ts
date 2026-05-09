import { canonicalJson, payloadHash } from '../canonical';

describe('canonicalJson', () => {
  it('produces same output regardless of key insertion order', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"a":2,"m":3,"z":1}');
  });

  it('produces same hash for same input', () => {
    const payload = { patientName: 'John Doe', receiptNumber: 'RCP-001', grandTotal: 100.5 };
    expect(payloadHash(payload)).toBe(payloadHash({ ...payload }));
  });

  it('produces different hash for different input', () => {
    const a = { receiptNumber: 'RCP-001' };
    const b = { receiptNumber: 'RCP-002' };
    expect(payloadHash(a)).not.toBe(payloadHash(b));
  });

  it('sorts nested object keys', () => {
    const a = { outer: { z: 1, a: 2 } };
    const b = { outer: { a: 2, z: 1 } };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"outer":{"a":2,"z":1}}');
  });

  it('preserves array order', () => {
    const a = { items: [{ id: 1 }, { id: 2 }] };
    const b = { items: [{ id: 2 }, { id: 1 }] };
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  });

  it('handles null and undefined by returning empty string', () => {
    expect(canonicalJson(null)).toBe('');
    expect(canonicalJson(undefined)).toBe('');
  });

  it('returns String representation for primitives (unquoted strings)', () => {
    expect(canonicalJson('hello')).toBe('hello');
    expect(canonicalJson(123)).toBe('123');
    expect(canonicalJson(true)).toBe('true');
  });

  it('handles nested objects with null/undefined values correctly', () => {
    const obj = { a: null, b: 3 };
    // keys: a, b
    // result: {"a":,"b":3}
    expect(canonicalJson(obj)).toBe('{"a":,"b":3}');
  });

  it('handles empty objects and arrays', () => {
    expect(canonicalJson({})).toBe('{}');
    expect(canonicalJson([])).toBe('[]');
  });

  it('handles complex structures deterministically', () => {
    const input = {
      z: [
        { c: 3, a: 1 },
        { b: 2, d: null }
      ],
      a: {
        y: 10,
        x: 'foo'
      }
    };
    const expected = '{"a":{"x":foo,"y":10},"z":[{"a":1,"c":3},{"b":2,"d":}]}';
    expect(canonicalJson(input)).toBe(expected);
  });
});
