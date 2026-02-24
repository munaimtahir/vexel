'use client';
import { EncounterStatusBadge } from './status-badge';

interface IdentityHeaderProps {
  patient: { firstName: string; lastName: string; mrn: string };
  encounterId: string;
  status: string;
  createdAt: string;
}

export default function IdentityHeader({ patient, encounterId, status, createdAt }: IdentityHeaderProps) {
  return (
    <div className="bg-card border border-border rounded-lg px-6 py-4 mb-6 flex flex-wrap gap-6 items-center">
      <div className="flex-1 min-w-[180px]">
        <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Patient</p>
        <p className="mt-0.5 text-base font-bold text-foreground">
          {patient.firstName} {patient.lastName}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground font-mono">MRN: {patient.mrn}</p>
      </div>
      <div className="min-w-[140px]">
        <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Encounter</p>
        <p className="mt-0.5 text-sm text-muted-foreground font-mono">{encounterId.slice(0, 8)}…</p>
      </div>
      <div className="min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-1">Status</p>
        <EncounterStatusBadge status={status} />
      </div>
      <div className="min-w-[120px]">
        <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Created</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {new Date(createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
