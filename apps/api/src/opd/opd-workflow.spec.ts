import { ConflictException } from '@nestjs/common';
import { assertOpdTransition, canTransitionOpd } from './opd-workflow';

describe('OPD canonical workflow', () => {
  it.each([
    ['DRAFT', 'READY_FOR_PRINT'], ['DRAFT', 'CANCELLED'],
    ['READY_FOR_PRINT', 'COMPLETED'], ['READY_FOR_PRINT', 'CANCELLED'],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransitionOpd(from, to as any)).toBe(true);
    expect(() => assertOpdTransition(from, to as any)).not.toThrow();
  });

  it.each([
    ['DRAFT', 'COMPLETED'], ['READY_FOR_PRINT', 'DRAFT'],
    ['COMPLETED', 'DRAFT'], ['CANCELLED', 'READY_FOR_PRINT'], ['UNKNOWN', 'COMPLETED'],
  ])('rejects %s -> %s with conflict', (from, to) => {
    expect(canTransitionOpd(from, to as any)).toBe(false);
    expect(() => assertOpdTransition(from, to as any)).toThrow(ConflictException);
  });
});
