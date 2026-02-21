import { canonicalJson, payloadHash } from '../canonical';

describe('canonicalJson', () => {
  it('produces same output regardless of key insertion order', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('produces same hash for same input', () => {
    const payload = { patientName: 'John Doe', receiptNumber: 'RCP-001', grandTotal: 100.5000 };
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
  });

  it('preserves array order', () => {
    const a = { items: [{ id: 1 }, { id: 2 }] };
    const b = { items: [{ id: 2 }, { id: 1 }] };
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  });
});
