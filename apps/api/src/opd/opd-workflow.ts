import { ConflictException } from '@nestjs/common';

export const OPD_STATES = ['DRAFT', 'READY_FOR_PRINT', 'COMPLETED', 'CANCELLED'] as const;
export type OpdState = (typeof OPD_STATES)[number];

const ALLOWED: Record<OpdState, readonly OpdState[]> = {
  DRAFT: ['READY_FOR_PRINT', 'CANCELLED'],
  READY_FOR_PRINT: ['COMPLETED', 'CANCELLED'],
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
