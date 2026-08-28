import { ConflictException } from '@nestjs/common';

export const OPD_STATES = [
  'REGISTERED',
  'INTAKE_COMPLETE',
  'IN_CONSULTATION',
  'NOTE_SIGNED',
  'PRESCRIPTION_PUBLISHED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OpdState = (typeof OPD_STATES)[number];

const ALLOWED: Record<OpdState, readonly OpdState[]> = {
  REGISTERED: ['INTAKE_COMPLETE', 'CANCELLED'],
  INTAKE_COMPLETE: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['NOTE_SIGNED', 'CANCELLED'],
  NOTE_SIGNED: ['PRESCRIPTION_PUBLISHED', 'COMPLETED', 'CANCELLED'],
  PRESCRIPTION_PUBLISHED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertOpdTransition(from: string, to: OpdState): void {
  if (!OPD_STATES.includes(from as OpdState) || !ALLOWED[from as OpdState].includes(to)) {
    throw new ConflictException(`Invalid OPD transition ${from} -> ${to}`);
  }
}

export function canTransitionOpd(from: string, to: OpdState): boolean {
  return OPD_STATES.includes(from as OpdState) && ALLOWED[from as OpdState].includes(to);
}
