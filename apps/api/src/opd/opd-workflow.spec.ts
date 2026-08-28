import { ConflictException } from '@nestjs/common';
import { assertOpdTransition, canTransitionOpd } from './opd-workflow';

describe('OPD canonical workflow', () => {
  it.each([
    ['REGISTERED', 'INTAKE_COMPLETE'], ['REGISTERED', 'CANCELLED'],
    ['INTAKE_COMPLETE', 'IN_CONSULTATION'], ['INTAKE_COMPLETE', 'CANCELLED'],
    ['IN_CONSULTATION', 'NOTE_SIGNED'], ['IN_CONSULTATION', 'CANCELLED'],
    ['NOTE_SIGNED', 'PRESCRIPTION_PUBLISHED'], ['NOTE_SIGNED', 'COMPLETED'],
    ['PRESCRIPTION_PUBLISHED', 'COMPLETED'], ['PRESCRIPTION_PUBLISHED', 'CANCELLED'],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransitionOpd(from, to as any)).toBe(true);
    expect(() => assertOpdTransition(from, to as any)).not.toThrow();
  });

  it.each([
    ['REGISTERED', 'COMPLETED'], ['INTAKE_COMPLETE', 'NOTE_SIGNED'],
    ['IN_CONSULTATION', 'COMPLETED'], ['COMPLETED', 'REGISTERED'],
    ['CANCELLED', 'INTAKE_COMPLETE'], ['UNKNOWN', 'COMPLETED'],
  ])('rejects %s -> %s with conflict', (from, to) => {
    expect(canTransitionOpd(from, to as any)).toBe(false);
    expect(() => assertOpdTransition(from, to as any)).toThrow(ConflictException);
  });
});
